import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generatePurchaseOrderExcelJS, PurchaseOrderData } from '@/utils/exceljs/generatePurchaseOrderExcel';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { orderNumber: string } }
) {
  try {
    const orderNumber = params.orderNumber;

    // 발주번호로 데이터 조회
    const { data: orderItems, error: itemsError } = await supabase
      .from('purchase_request_view')
      .select('*')
      .eq('purchase_order_number', orderNumber);

    if (itemsError || !orderItems || orderItems.length === 0) {
      return NextResponse.json(
        { error: '해당 발주번호의 데이터를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const firstItem = orderItems[0];
    
    // 업체 상세 정보 및 담당자 정보 조회
    let vendorInfo = {
      vendor_name: firstItem.vendor_name,
      vendor_phone: '',
      vendor_fax: '',
      vendor_contact_name: '',
      vendor_payment_schedule: ''
    };

    try {
      // purchase_requests 테이블에서 vendor_id, contact_id 조회
      const { data: prData, error: prError } = await supabase
        .from('purchase_requests')
        .select('vendor_id, contact_id')
        .eq('purchase_order_number', orderNumber)
        .single();

      if (prData && !prError) {
        const vendorId = prData.vendor_id;
        const contactId = prData.contact_id;
        
        // vendor 정보 조회
        const { data: vendorData, error: vendorError } = await supabase
          .from('vendors')
          .select('vendor_phone, vendor_fax, vendor_payment_schedule')
          .eq('id', vendorId)
          .single();

        if (vendorData && !vendorError) {
          vendorInfo.vendor_phone = vendorData.vendor_phone || '';
          vendorInfo.vendor_fax = vendorData.vendor_fax || '';
          vendorInfo.vendor_payment_schedule = vendorData.vendor_payment_schedule || '';
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
      }
    } catch (error) {
      console.warn('업체 정보 조회 중 오류:', error);
    }

    // 엑셀 데이터 준비
    const excelData = {
      purchase_order_number: firstItem.purchase_order_number || '',
      request_date: firstItem.request_date,
      delivery_request_date: firstItem.delivery_request_date,
      requester_name: firstItem.requester_name,
      vendor_name: vendorInfo.vendor_name,
      vendor_contact_name: vendorInfo.vendor_contact_name,
      vendor_phone: vendorInfo.vendor_phone,
      vendor_fax: vendorInfo.vendor_fax,
      project_vendor: firstItem.project_vendor,
      sales_order_number: firstItem.sales_order_number,
      project_item: firstItem.project_item,
      vendor_payment_schedule: vendorInfo.vendor_payment_schedule,
      items: orderItems.map(item => ({
        line_number: item.line_number,
        item_name: item.item_name,
        specification: item.specification,
        quantity: item.quantity,
        unit_price_value: item.unit_price_value,
        amount_value: item.amount_value,
        remark: item.remark,
        currency: item.currency
      }))
    };

    // 엑셀 파일 생성
    const blob = await generatePurchaseOrderExcelJS(excelData as PurchaseOrderData);
    const buffer = await blob.arrayBuffer();
    
    // 파일명 생성
    const filename = `발주서_${excelData.vendor_name}_${excelData.purchase_order_number}.xlsx`;

    // HTTP 응답으로 엑셀 파일 반환
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('엑셀 생성 오류:', error);
    return NextResponse.json(
      { error: '엑셀 파일 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 