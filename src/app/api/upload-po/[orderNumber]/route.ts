import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generatePurchaseOrderExcelJS, PurchaseOrderData } from '@/utils/exceljs/generatePurchaseOrderExcel';

// Service Role 클라이언트 (Storage 업로드 권한)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;

    // 발주번호로 구매 요청 데이터 조회
    const { data: purchaseRequest, error: requestError } = await supabase
      .from('purchase_requests')
      .select('*')
      .eq('purchase_order_number', orderNumber)
      .single();

    if (requestError || !purchaseRequest) {
      return NextResponse.json(
        { error: '해당 발주번호의 데이터를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 품목 데이터 조회 - purchase_request_id로 조회하도록 수정
    const { data: orderItems, error: itemsError } = await supabase
      .from('purchase_request_items')
      .select('*')
      .eq('purchase_request_id', purchaseRequest.id)
      .order('line_number');

    if (itemsError || !orderItems || orderItems.length === 0) {
      return NextResponse.json(
        { error: '해당 발주번호의 품목 데이터를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    // 엑셀 데이터 준비
    const excelData = {
      purchase_order_number: purchaseRequest.purchase_order_number || '',
      request_date: purchaseRequest.request_date,
      delivery_request_date: purchaseRequest.delivery_request_date,
      requester_name: purchaseRequest.requester_name,
      vendor_name: '',
      vendor_contact_name: '',
      vendor_phone: '',
      vendor_fax: '',
      project_vendor: purchaseRequest.project_vendor,
      sales_order_number: purchaseRequest.sales_order_number,
      project_item: purchaseRequest.project_item,
      vendor_payment_schedule: '',
      items: orderItems.map(item => ({
        line_number: item.line_number,
        item_name: item.item_name,
        specification: item.specification,
        quantity: item.quantity,
        unit_price_value: item.unit_price_value,
        amount_value: item.amount_value,
        remark: item.remark,
        currency: purchaseRequest.currency || 'KRW'
      }))
    };

    // 업체 상세 정보 및 담당자 정보 조회
    let vendorInfo = {
      vendor_name: '',
      vendor_phone: '',
      vendor_fax: '',
      vendor_contact_name: '',
      vendor_payment_schedule: ''
    };

    try {
      const vendorId = purchaseRequest.vendor_id;
      const contactId = purchaseRequest.contact_id;
      
      // vendor 정보 조회
      if (vendorId) {
        const { data: vendorData, error: vendorError } = await supabase
          .from('vendors')
          .select('vendor_name, vendor_phone, vendor_fax, vendor_payment_schedule')
          .eq('id', vendorId)
          .single();

        if (vendorData && !vendorError) {
          vendorInfo.vendor_name = vendorData.vendor_name || '';
          vendorInfo.vendor_phone = vendorData.vendor_phone || '';
          vendorInfo.vendor_fax = vendorData.vendor_fax || '';
          vendorInfo.vendor_payment_schedule = vendorData.vendor_payment_schedule || '';
        }
      }

      // vendor_contacts에서 contact_id로 담당자 정보 조회
      if (contactId) {
        const { data: contactData, error: contactError } = await supabase
          .from('vendor_contacts')
          .select('contact_name, contact_phone, contact_email')
          .eq('id', contactId)
          .single();
        if (contactData && !contactError) {
          vendorInfo.vendor_contact_name = contactData.contact_name || '';
        }
      }
    } catch (error) {
      console.warn('업체 정보 조회 중 오류:', error);
    }

    // 엑셀 데이터 준비
    excelData.vendor_name = vendorInfo.vendor_name;
    excelData.vendor_contact_name = vendorInfo.vendor_contact_name;
    excelData.vendor_phone = vendorInfo.vendor_phone;
    excelData.vendor_fax = vendorInfo.vendor_fax;
    excelData.vendor_payment_schedule = vendorInfo.vendor_payment_schedule;

    // 엑셀 파일 생성
    console.log('엑셀 파일 생성 시작:', orderNumber);
    const blob = await generatePurchaseOrderExcelJS(excelData as PurchaseOrderData);
    console.log('엑셀 파일 생성 완료, blob 타입:', typeof blob, 'blob 크기:', blob.size);
    
    // Storage 업로드
    const storageFilename = `${excelData.purchase_order_number}.xlsx`;
    const downloadFilename = `발주서_${excelData.vendor_name}_${excelData.purchase_order_number}.xlsx`;
    
    console.log('Storage 업로드 시작:', storageFilename);
    
    try {
      // 기존 파일 삭제
      const { error: removeError } = await supabase.storage
        .from('po-files')
        .remove([storageFilename]);
      
      if (removeError) {
        console.warn('기존 파일 삭제 오류 (무시):', removeError);
      }
      
      // Supabase Storage에 업로드
      console.log('Storage 업로드 시도:', {
        filename: storageFilename,
        blobSize: blob.size,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('po-files')
        .upload(storageFilename, blob, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          cacheControl: 'no-cache'
        });
      
      if (uploadError) {
        console.error('Storage 업로드 오류 상세:', {
          error: uploadError,
          message: uploadError.message
        });
        return NextResponse.json(
          { error: 'Storage 업로드 실패', details: uploadError, filename: storageFilename },
          { status: 500 }
        );
      }
      
      console.log('Storage 업로드 성공:', uploadData);
      
      // Storage URL 생성
      const { data: urlData } = supabase.storage
        .from('po-files')
        .getPublicUrl(storageFilename, {
          download: downloadFilename
        });
      
      console.log('Storage 업로드 완료:', storageFilename, 'URL:', urlData.publicUrl);
      
      return NextResponse.json({
        success: true,
        message: `발주서 ${orderNumber} Storage 업로드 완료`,
        storage_url: urlData.publicUrl,
        filename: storageFilename
      });
      
    } catch (storageErr) {
      console.error('Storage 처리 예외 오류:', {
        error: storageErr,
        message: storageErr instanceof Error ? storageErr.message : String(storageErr),
        stack: storageErr instanceof Error ? storageErr.stack : undefined
      });
      return NextResponse.json(
        { 
          error: 'Storage 처리 중 오류 발생', 
          details: storageErr instanceof Error ? storageErr.message : String(storageErr),
          filename: storageFilename
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('발주서 업로드 오류:', error);
    return NextResponse.json(
      { error: '발주서 업로드 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}