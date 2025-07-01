import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ExcelJS 대신 Deno에서 사용 가능한 xlsx 라이브러리 사용
import * as XLSX from "https://cdn.skypack.dev/xlsx@0.18.5";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface PurchaseOrderData {
  purchase_order_number: string;
  request_date: string;
  delivery_request_date?: string;
  requester_name: string;
  vendor_name: string;
  vendor_contact_name?: string;
  vendor_phone?: string;
  vendor_fax?: string;
  project_vendor?: string;
  sales_order_number?: string;
  project_item?: string;
  vendor_payment_schedule?: string;
  items: Array<{
    line_number: number;
    item_name: string;
    specification: string;
    quantity: number;
    unit_price_value: number;
    amount_value: number;
    remark?: string;
    currency: string;
  }>;
  progress_type: string;
  final_manager_status: string;
  request_type: string;
}

async function generatePurchaseOrderExcel(data: PurchaseOrderData): Promise<ArrayBuffer> {
  const wb = XLSX.utils.book_new();
  
  // 발주서 헤더 데이터
  const headerData = [
    ['발주서'],
    [''],
    ['업체명', data.vendor_name, '', '', '구매요청자', data.requester_name],
    ['담당자', data.vendor_contact_name || '', '', '', '청구일', data.request_date],
    ['TEL.', data.vendor_phone || '', '', '', '발주번호', data.purchase_order_number],
    ['FAX.', data.vendor_fax || '', '', '', '', ''],
    ['지출예정일', data.delivery_request_date || '', '', '', '', ''],
    [''],
    ['번호', '품명', '규격', '수량', '단가', '합계', '비고']
  ];
  
  // 품목 데이터 추가
  const itemsData = data.items.map(item => [
    item.line_number,
    item.item_name,
    item.specification,
    item.quantity,
    item.unit_price_value,
    item.amount_value,
    item.remark || ''
  ]);
  
  // 총합계 계산
  const totalAmount = data.items.reduce((sum, item) => sum + item.amount_value, 0);
  
  // 하단 정보
  const footerData = [
    ['', '', '', '', '', '총 합계', totalAmount],
    [''],
    ['PJ업체', data.project_vendor || ''],
    ['수주번호', data.sales_order_number || ''],
    ['Item', data.project_item || '']
  ];
  
  // 모든 데이터 결합
  const allData = [...headerData, ...itemsData, ...footerData];
  
  const ws = XLSX.utils.aoa_to_sheet(allData);
  XLSX.utils.book_append_sheet(wb, ws, '발주서');
  
  // ArrayBuffer로 변환
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return excelBuffer.buffer;
}

async function fetchPurchaseOrderData(orderNumber: string): Promise<PurchaseOrderData | null> {
  try {
    // 발주 요청 기본 정보 조회
    const { data: purchaseRequest, error: prError } = await supabase
      .from('purchase_requests')
      .select('*')
      .eq('purchase_order_number', orderNumber)
      .single();

    if (prError || !purchaseRequest) {
      console.error('Purchase request not found:', prError);
      return null;
    }

    // 업체 정보 조회
    const { data: vendor } = await supabase
      .from('vendors')
      .select('vendor_name, vendor_phone, vendor_fax, vendor_payment_schedule')
      .eq('id', purchaseRequest.vendor_id)
      .single();

    // 담당자 정보 조회 (있는 경우에만)
    let vendorContact = null;
    if (purchaseRequest.contact_id) {
      const { data: contact } = await supabase
        .from('vendor_contacts')
        .select('contact_name, contact_phone, contact_email')
        .eq('id', purchaseRequest.contact_id)
        .single();
      vendorContact = contact;
    }

    // 품목 정보 조회
    const { data: items, error: itemsError } = await supabase
      .from('purchase_request_items')
      .select('*')
      .eq('purchase_request_id', purchaseRequest.id)
      .order('line_number');

    if (itemsError || !items) {
      console.error('Purchase items not found:', itemsError);
      return null;
    }

    return {
      purchase_order_number: purchaseRequest.purchase_order_number,
      request_date: purchaseRequest.request_date,
      delivery_request_date: purchaseRequest.delivery_request_date,
      requester_name: purchaseRequest.requester_name,
      vendor_name: vendor?.vendor_name || '',
      vendor_contact_name: vendorContact?.contact_name || '',
      vendor_phone: vendor?.vendor_phone || '',
      vendor_fax: vendor?.vendor_fax || '',
      project_vendor: purchaseRequest.project_vendor,
      sales_order_number: purchaseRequest.sales_order_number,
      project_item: purchaseRequest.project_item,
      vendor_payment_schedule: vendor?.vendor_payment_schedule || '',
      items: items.map(item => ({
        line_number: item.line_number,
        item_name: item.item_name,
        specification: item.specification,
        quantity: item.quantity,
        unit_price_value: item.unit_price_value,
        amount_value: item.amount_value,
        remark: item.remark,
        currency: item.amount_currency || 'KRW'
      })),
      progress_type: purchaseRequest.progress_type,
      final_manager_status: purchaseRequest.final_manager_status,
      request_type: purchaseRequest.request_type
    };
  } catch (error) {
    console.error('Error fetching purchase order data:', error);
    return null;
  }
}

async function uploadToStorage(orderNumber: string, excelBuffer: ArrayBuffer): Promise<string | null> {
  const filename = `${orderNumber}.xlsx`;
  
  try {
    // 기존 파일 삭제
    await supabase.storage
      .from('po-files')
      .remove([filename]);
    
    // 새 파일 업로드
    const { error: uploadError } = await supabase.storage
      .from('po-files')
      .upload(filename, excelBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        cacheControl: 'no-cache'
      });
    
    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return null;
    }
    
    // 공개 URL 생성
    const { data: urlData } = supabase.storage
      .from('po-files')
      .getPublicUrl(filename);
    
    console.log('Successfully uploaded to storage:', filename);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Upload process error:', error);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  try {
    const { purchase_order_number } = await req.json();
    
    if (!purchase_order_number) {
      return new Response(
        JSON.stringify({ error: 'purchase_order_number is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Processing auto upload for order:', purchase_order_number);
    
    // 1. 발주 데이터 조회
    const orderData = await fetchPurchaseOrderData(purchase_order_number);
    if (!orderData) {
      return new Response(
        JSON.stringify({ error: 'Order data not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // 2. 엑셀 파일 생성
    const excelBuffer = await generatePurchaseOrderExcel(orderData);
    
    // 3. Storage에 업로드
    const publicUrl = await uploadToStorage(purchase_order_number, excelBuffer);
    if (!publicUrl) {
      return new Response(
        JSON.stringify({ error: 'Upload failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Auto upload completed successfully:', publicUrl);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        public_url: publicUrl,
        message: `발주서 ${purchase_order_number} 자동 업로드 완료`
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Auto upload error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});