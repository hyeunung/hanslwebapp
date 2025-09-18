import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generatePurchaseOrderExcelJS, PurchaseOrderData } from '@/utils/exceljs/generatePurchaseOrderExcel';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Storage 업로드용 Service Role 클라이언트
const supabaseServiceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// HEAD 요청 처리 (다운로드 가능 여부 검증용)
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    
    // 발주번호로 구매 요청 데이터 존재 여부만 확인
    const { data: purchaseRequest, error: requestError } = await supabase
      .from('purchase_requests')
      .select('id')
      .eq('purchase_order_number', orderNumber)
      .single();

    if (requestError || !purchaseRequest) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    return new NextResponse(null, { status: 500 });
  }
}

// OPTIONS 요청 처리 (CORS 프리플라이트)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function GET(
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

    // 품목 데이터 조회
    const { data: orderItems, error: itemsError } = await supabase
      .from('purchase_request_items')
      .select('*')
      .eq('purchase_order_number', orderNumber)
      .order('line_number');


    if (itemsError || !orderItems || orderItems.length === 0) {
      return NextResponse.json(
        { error: '해당 발주번호의 품목 데이터를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
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
    }

    // 엑셀 데이터 준비
    const excelData = {
      purchase_order_number: purchaseRequest.purchase_order_number || '',
      request_date: purchaseRequest.request_date,
      delivery_request_date: purchaseRequest.delivery_request_date,
      requester_name: purchaseRequest.requester_name,
      vendor_name: vendorInfo.vendor_name,
      vendor_contact_name: vendorInfo.vendor_contact_name,
      vendor_phone: vendorInfo.vendor_phone,
      vendor_fax: vendorInfo.vendor_fax,
      project_vendor: purchaseRequest.project_vendor,
      sales_order_number: purchaseRequest.sales_order_number,
      project_item: purchaseRequest.project_item,
      vendor_payment_schedule: vendorInfo.vendor_payment_schedule,
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

    // 엑셀 파일 생성
    const blob = await generatePurchaseOrderExcelJS(excelData as PurchaseOrderData);
    const buffer = await blob.arrayBuffer();
    
    // 파일명 생성 (다운로드용과 Storage용)
    const downloadFilename = `발주서_${excelData.vendor_name}_${excelData.purchase_order_number}.xlsx`;
    const storageFilename = `${excelData.purchase_order_number}.xlsx`;

    // User-Agent 확인하여 트리거에서 호출된 경우 Storage에도 업로드
    const userAgent = request.headers.get('user-agent') || '';
    const isAutoUploadTrigger = userAgent.includes('Auto-Upload-Trigger');

    if (isAutoUploadTrigger) {
      try {
        // 기존 파일이 있으면 삭제 후 업로드 (Service Role 사용)
        await supabaseServiceRole.storage
          .from('po-files')
          .remove([storageFilename]);
        
        // Supabase Storage에 업로드 (Service Role 사용)
        const { error: uploadError } = await supabaseServiceRole.storage
          .from('po-files')
          .upload(storageFilename, buffer, {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            cacheControl: 'no-cache'
          });
        
        if (uploadError) {
        } else {
        }
      } catch (storageErr) {
      }
    }

    // is_po_download 필드를 true로 업데이트 (Service Role 사용)
    try {
      const { error: updateError } = await supabaseServiceRole
        .from('purchase_requests')
        .update({ is_po_download: true })
        .eq('purchase_order_number', orderNumber);
      
      if (updateError) {
      } else {
      }
    } catch (updateErr) {
    }

    // HTTP 응답으로 엑셀 파일 반환
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloadFilename)}`,
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    return NextResponse.json(
      { error: '엑셀 파일 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 