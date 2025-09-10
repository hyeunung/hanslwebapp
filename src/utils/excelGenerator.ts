import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface PurchaseOrderData {
  purchase_order_number: string;
  request_date: string;
  delivery_request_date: string;
  requester_name: string;
  vendor_name: string;
  vendor_contact_name?: string;
  vendor_phone?: string;
  vendor_fax?: string;
  project_vendor: string;
  sales_order_number: string;
  project_item: string;
  items: PurchaseOrderItem[];
}

interface PurchaseOrderItem {
  line_number: number;
  item_name: string;
  specification: string;
  quantity: number;
  unit_price_value: number;
  amount_value: number;
  remark: string;
  currency: string;
}

// 날짜 포맷 함수
export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

export function formatDateForFileName(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'unknown_date';
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  } catch {
    return 'unknown_date';
  }
}

export function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency }).format(value);
}

// 템플릿 기반 Excel 생성 함수 (개선된 버전)
export async function generatePurchaseOrderExcel(data: PurchaseOrderData) {
  try {
    
    // 방법 1: 원본 템플릿 파일 로드 시도
    try {
      const templateUrl = '/templates/발주서(Default)-3.xlsx';
      
      const response = await fetch(templateUrl);
      
      if (!response.ok) {
        throw new Error(`템플릿 로드 실패: ${response.status} ${response.statusText}`);
      }
      
      const templateBuffer = await response.arrayBuffer();
      
      if (templateBuffer.byteLength === 0) {
        throw new Error('템플릿 파일이 비어있습니다');
      }
      
      const wb = XLSX.read(templateBuffer, { 
        type: 'array',
        cellStyles: true,    // 셀 스타일 보존
        cellHTML: false,     // HTML 변환 비활성화
        cellFormula: true,   // 수식 보존
        sheetStubs: true,    // 빈 셀도 포함
        cellDates: true      // 날짜 형식 보존
      });
      
      if (wb.SheetNames.length === 0) {
        throw new Error('템플릿에 시트가 없습니다');
      }
      
      // 첫 번째 시트 사용
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      
      // 템플릿의 원본 서식과 구조 보존하면서 데이터만 교체
      
      // 기본 정보 교체 (실제 템플릿의 셀 위치에 맞게 수정)
      setCellValueSafely(ws, 'C2', data.vendor_name || ''); // 업체명 (company_name 위치)
      setCellValueSafely(ws, 'F2', data.requester_name || ''); // 구매요구자 (Order_name 위치에 requester_name)
      setCellValueSafely(ws, 'C3', data.vendor_contact_name || ''); // 담당자 (manager_name 위치)
      setCellValueSafely(ws, 'C4', formatDate(data.request_date) || ''); // 청구일 (order_date 위치)
      setCellValueSafely(ws, 'F4', data.purchase_order_number || ''); // 발주번호 (Order_Number 위치)
      setCellValueSafely(ws, 'C5', data.vendor_phone || ''); // 전화번호 (TEL 위치)
      setCellValueSafely(ws, 'C6', data.vendor_fax || ''); // 팩스번호 (FAX 위치)
      setCellValueSafely(ws, 'C7', formatDate(data.delivery_request_date) || ''); // 입고요청일 (request_date 위치)
      
      // 품목 데이터 교체 (A9부터 시작)
      data.items.forEach((item, index) => {
        const rowNum = 9 + index;
        setCellValueSafely(ws, `A${rowNum}`, item.line_number || (index + 1));
        setCellValueSafely(ws, `B${rowNum}`, item.item_name || '');
        setCellValueSafely(ws, `C${rowNum}`, item.specification || '');
        setCellValueSafely(ws, `D${rowNum}`, item.quantity || 0);
        setCellValueSafely(ws, `E${rowNum}`, item.unit_price_value || 0);
        setCellValueSafely(ws, `F${rowNum}`, item.amount_value || 0);
        setCellValueSafely(ws, `G${rowNum}`, item.remark || '');
      });
      
      // 총 금액 계산 및 입력
      const totalAmount = data.items.reduce((sum, item) => sum + (item.amount_value || 0), 0);
      setCellValueSafely(ws, 'W47', totalAmount); // 합계액
      
      // 하단 정보 입력 (실제 템플릿 위치에 맞게 수정)
      setCellValueSafely(ws, 'G48', data.project_vendor || ''); // PJ업체 (pj_manager 위치)
      setCellValueSafely(ws, 'G49', data.sales_order_number || ''); // 수주번호 (pj_name 위치)
      setCellValueSafely(ws, 'G50', data.project_item || ''); // 아이템 (pj_item 위치)
      
      // 원본 템플릿 기반 파일 저장
      await saveWorkbook(wb, data);
      return;
      
    } catch (templateError) {
      // 폴백 모드는 아래에서 실행됨
    }
    
    // 방법 2: 폴백 - 기본 Excel 생성 (디자인 없음)
    await generateFallbackExcel(data);
    
  } catch (error) {
    throw error;
  }
  
}

// 안전한 셀 값 설정 함수
function setCellValueSafely(ws: XLSX.WorkSheet, cellAddress: string, value: any) {
  try {
    // 기존 셀이 있는 경우 값만 변경 (서식 보존)
    if (ws[cellAddress]) {
      const originalCell = ws[cellAddress];
      ws[cellAddress] = {
        ...originalCell, // 기존 서식 보존
        v: value,        // 값만 변경
        t: typeof value === 'number' ? 'n' : 's'
      };
    } else {
      // 새 셀 생성
      ws[cellAddress] = { 
        v: value, 
        t: typeof value === 'number' ? 'n' : 's'
      };
    }
  } catch (error) {
  }
}

// 폴백 Excel 생성 함수
async function generateFallbackExcel(data: PurchaseOrderData) {
  
  try {
    const wb = XLSX.utils.book_new();
    
    // 발주서 헤더 데이터 준비
    const headerData = [
      ['한슬테크닉스 발주서', '', '', '', '', '', '', '', '', ''], // Row 1 - 제목
      ['', '', '', '', '', '', '', '', '', ''], // Row 2 - 공백
      ['업체명', data.vendor_name, '', '', '구매요구자', data.requester_name, '', '', '', ''], // Row 3
      ['', '', '', '', '', '', '', '', '', ''], // Row 4 - 공백
      ['청구일', formatDate(data.request_date), '', '', '발주번호', data.purchase_order_number, '', '', '', ''], // Row 5
      ['', '', '', '', '', '', '', '', '', ''], // Row 6 - 공백
      ['입고요청일', formatDate(data.delivery_request_date), '', '', '', '', '', '', '', ''], // Row 7
      ['', '', '', '', '', '', '', '', '', ''], // Row 8 - 공백
      ['품목명', '규격', '수량', '단가', '금액', '비고', '', '', '', ''] // Row 9 - 테이블 헤더
    ];
    
    // 품목 데이터 준비
    const itemsData = data.items.map(item => [
      item.item_name,
      item.specification,
      item.quantity,
      item.unit_price_value,
      item.amount_value,
      item.remark,
      '', '', '', ''
    ]);
    
    // 전체 금액 계산
    const totalAmount = data.items.reduce((sum, item) => sum + item.amount_value, 0);
    
    // 빈 행들 추가 (템플릿과 유사한 구조를 위해)
    const emptyRows = Array(30).fill(['', '', '', '', '', '', '', '', '', '']);
    
    // 하단 정보
    const footerData = [
      ['', '', '', '', '', '', '', '', '합계금액', totalAmount],
      ['', '', '', '', '', '', '', '', '', ''],
      ['수주번호', data.sales_order_number || '', '', '', '', '', '', '', '', ''],
      ['PJ업체', data.project_vendor || '', '', '', '', '', '', '', '', ''],
      ['아이템', data.project_item || '', '', '', '', '', '', '', '', '']
    ];
    
    // 모든 데이터 합치기
    const allData = [...headerData, ...itemsData, ...emptyRows, ...footerData];
    
    
    // 워크시트 생성
    const ws = XLSX.utils.aoa_to_sheet(allData);
    
    // 기본 셀 스타일링
    try {
      if (ws['A1']) {
        ws['A1'].s = {
          font: { bold: true, sz: 16 },
          alignment: { horizontal: 'center' }
        };
      }
    } catch (styleError) {
    }
    
    // 워크시트를 워크북에 추가
    XLSX.utils.book_append_sheet(wb, ws, '발주서');
    
    
    // 파일 생성 및 다운로드
    await saveWorkbook(wb, data);
    
  } catch (error) {
    throw error;
  }
}

// 워크북 저장 함수
async function saveWorkbook(wb: XLSX.WorkBook, data: PurchaseOrderData) {
  
  try {
    const excelBuffer = XLSX.write(wb, { 
      bookType: 'xlsx', 
      type: 'array',
      bookSST: false
    });
    
    
    // Blob 생성
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    
    
    // 파일명 생성
    const filename = `발주서_${data.purchase_order_number}_${data.vendor_name}_${formatDateForFileName(data.request_date)}.xlsx`;
    
    
    // 다운로드
    saveAs(blob, filename);
    
    
  } catch (error) {
    throw error;
  }
}