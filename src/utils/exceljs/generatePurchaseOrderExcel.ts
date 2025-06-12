import ExcelJS from 'exceljs';

export interface PurchaseOrderData {
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

export interface PurchaseOrderItem {
  line_number: number;
  item_name: string;
  specification: string;
  quantity: number;
  unit_price_value: number;
  amount_value: number;
  remark: string;
  currency: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Helper: currency code to symbol
function getCurrencySymbol(currency: string) {
  if (!currency) return '';
  if (['KRW', '원', '₩'].includes(currency)) return '₩';
  if (['USD', '$', '달러'].includes(currency)) return '$';
  if (['EUR', '€'].includes(currency)) return '€';
  if (['JPY', '엔', '¥'].includes(currency)) return '¥';
  if (['CNY', '위안', '元'].includes(currency)) return '¥';
  return currency;
}

/**
 * 엑셀 발주서 생성 (ExcelJS)
 * @param data PurchaseOrderData
 * @returns Blob (xlsx)
 */
export async function generatePurchaseOrderExcelJS(data: PurchaseOrderData): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('발주서', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      verticalCentered: true,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2
      }
    }
  });

  // 모든 행에 대해 픽셀 기준 15.75px에 근접하게 11.8pt로 지정
  for (let r = 2; r <= 50; r++) {
    sheet.getRow(r).height = 11.8;
  }
  // 1행: 39.75px = 약 29.8pt (1pt ≈ 1.333px)
  sheet.getRow(1).height = 29.8;

  // 1. 병합 범위 템플릿과 1:1 적용
  sheet.mergeCells('A1:G1');
  sheet.mergeCells('A2:B2'); sheet.mergeCells('C2:D2'); sheet.mergeCells('F2:G2');
  sheet.mergeCells('A3:B3'); sheet.mergeCells('C3:D3'); sheet.mergeCells('F3:G3');
  sheet.mergeCells('A4:B4'); sheet.mergeCells('C4:D4'); sheet.mergeCells('F4:G4');
  sheet.mergeCells('A5:B5'); sheet.mergeCells('C5:D5'); sheet.mergeCells('F5:G5');
  sheet.mergeCells('A6:B6'); sheet.mergeCells('C6:D6'); sheet.mergeCells('F6:G6');
  sheet.mergeCells('A7:B7'); sheet.mergeCells('C7:D7'); sheet.mergeCells('E7:F7');
  // 8~46행(헤더/품목/합계) 병합 없음
  sheet.mergeCells('A47:E47');
  // 하단 정보(48~50행) 병합 없음

  try {
    const response = await fetch('/logo.png');
    const arrayBuffer = await response.arrayBuffer();
    const imageId = workbook.addImage({
      buffer: arrayBuffer,
      extension: 'png',
    });
    // 로고(이모티콘)는 너비 0.58col, '발주서' 글자 바로 왼쪽에 딱 붙게 배치
    // D열 width가 undefined/null/0이면 기본값 22로 대체
    const dWidth = sheet.getColumn('D').width || 22;
    const logoWidth = Math.max(1, dWidth * 7.2 * 0.58); // 최소 1px 보장
    // 이미지 높이를 28로 줄여 1행 높이(29.8pt)보다 작게 설정
    const logoHeight = 28;
    sheet.addImage(imageId, {
      tl: { col: 3.35, row: 0.1 }, // D1 바로 왼쪽(3.35col), 약간 아래
      ext: { width: logoWidth, height: logoHeight },
    });
  } catch (e) {}

  // 2. 제목 (B1:H1 병합, 중앙정렬)
  sheet.getCell('D1').value = '발 주 서';
  sheet.getCell('D1').alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getCell('D1').font = { bold: true, size: 20 };

  // 3. 상단 정보 고정 라벨 적용 (공백 포함)
  sheet.getCell('A2').value = '업   체   명';
  sheet.getCell('A3').value = '담   당   자';
  sheet.getCell('A4').value = '청   구   일';
  sheet.getCell('A5').value = 'TEL.';
  sheet.getCell('A6').value = 'FAX.';
  sheet.getCell('A7').value = '입 고 요 청 일';

  sheet.getCell('E2').value = '구매요청자';
  sheet.getCell('E3').value = '주         소';
  sheet.getCell('E4').value = '발 주 번 호';
  sheet.getCell('E5').value = 'TEL.';
  sheet.getCell('E6').value = 'FAX.';

  // 데이터 매핑(예시)
  sheet.getCell('C2').value = data.vendor_name;
  sheet.getCell('C3').value = data.vendor_contact_name || '';
  sheet.getCell('C4').value = formatDate(data.request_date);
  sheet.getCell('C5').value = data.vendor_phone || '';
  sheet.getCell('C6').value = data.vendor_fax || '';
  sheet.getCell('C7').value = formatDate(data.delivery_request_date);

  sheet.getCell('F2').value = data.requester_name;
  sheet.getCell('F3').value = '대구광역시 달서구 성서공단북로305';
  sheet.getCell('F4').value = data.purchase_order_number;
  sheet.getCell('F5').value = data.vendor_phone || '';
  sheet.getCell('F6').value = data.vendor_fax || '';

  // 8행: 테이블 헤더
  const tableHeaders = ['No', '품명', '규격', '수량', '단가', '금액', '비고'];
  for (let i = 0; i < tableHeaders.length; i++) {
    sheet.getCell(String.fromCharCode(65 + i) + '8').value = tableHeaders[i];
  }

  // 품목이 35개를 넘으면 아래로 밀어서 합계/하단 정보 출력
  const baseRow = 9;
  const maxItemsBeforePush = 35;
  const itemRows = data.items.length;
  const sumRow = baseRow + itemRows; // 합계 위치
  const infoRow1 = sumRow + 1;
  const infoRow2 = sumRow + 2;
  const infoRow3 = sumRow + 3;

  // 품목 데이터
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    const rowIdx = baseRow + i;
    sheet.getCell('A' + rowIdx).value = item.line_number;
    sheet.getCell('B' + rowIdx).value = item.item_name;
    sheet.getCell('C' + rowIdx).value = item.specification;
    sheet.getCell('D' + rowIdx).value = item.quantity;
    // 단가(E열) - 통화 기호 포함
    const unitSymbol = getCurrencySymbol(item.currency);
    const unitWithCurrency = (item.unit_price_value !== undefined && item.unit_price_value !== null)
      ? `${item.unit_price_value.toLocaleString()} ${unitSymbol}`.trim()
      : '';
    sheet.getCell('E' + rowIdx).value = unitWithCurrency;
    sheet.getCell('E' + rowIdx).alignment = { horizontal: 'right', vertical: 'middle' };

    // 금액(F열) - 통화 기호 포함
    const amountSymbol = getCurrencySymbol(item.currency);
    const amountWithCurrency = (item.amount_value !== undefined && item.amount_value !== null)
      ? `${item.amount_value.toLocaleString()} ${amountSymbol}`.trim()
      : '';
    sheet.getCell('F' + rowIdx).value = amountWithCurrency;
    sheet.getCell('F' + rowIdx).alignment = { horizontal: 'right', vertical: 'middle' };
    // G열은 비워둠
    sheet.getCell('G' + rowIdx).value = '';
  }

  // 합계
  sheet.getCell('A' + sumRow).value = '합계';
  const totalSymbol = getCurrencySymbol(data.items[0]?.currency);
  const totalAmount = data.items.reduce((sum, item) => sum + (item.amount_value || 0), 0);
  sheet.getCell('F' + sumRow).value = `${totalAmount.toLocaleString()} ${totalSymbol}`.trim();
  sheet.getCell('F' + sumRow).alignment = { horizontal: 'right', vertical: 'middle' };

  // 하단 정보(라벨+값, 오른쪽 한 칸씩)
  sheet.getCell('F' + infoRow1).value = 'PJ업체';
  sheet.getCell('F' + infoRow2).value = '수주번호';
  sheet.getCell('F' + infoRow3).value = 'item';
  sheet.getCell('G' + infoRow1).value = data.project_vendor || '';
  sheet.getCell('G' + infoRow2).value = data.sales_order_number || '';
  sheet.getCell('G' + infoRow3).value = data.project_item || '';

  // 열 너비 (템플릿 기준)
  const colWidths = { A:5.5, B:11.83, C:30.83, D:11.83, E:14.83, F:16.83, G:38.17 };
  Object.entries(colWidths).forEach(([col, width]) => {
    sheet.getColumn(col).width = width;
  });

  // 테두리: 병합 구조에 맞춰 대표 셀만 적용, 나머지는 단일 셀 전체 적용
  // 병합 대표 셀 좌표 집합 (템플릿 기준)
  const mergedCellLeads = new Set([
    'A1',
    'A2','C2','F2',
    'A3','C3','F3',
    'A4','C4','F4',
    'A5','C5','F5',
    'A6','C6','F6',
    'A7','C7','E7',
    'A47',
  ]);
  for (let r = 1; r <= 50; r++) {
    for (let c = 1; c <= 7; c++) {
      const col = String.fromCharCode(64 + c); // A~G
      const cellAddr = col + r;
      const cell = sheet.getCell(cellAddr);
      // 셀 정렬: 모두 중앙 정렬
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      // 1~47행: A~G 전체 외곽선만 굵게, 내부는 얇게 + 2행/8행/47행 위, 8행 아래 굵은선
      if (r >= 1 && r <= 47) {
        cell.border = {
          top:    { style: (r === 1) ? 'medium' : (r === 2 || r === 8 || r === 47) ? 'medium' : 'thin' },
          left:   { style: c === 1 ? 'medium' : 'thin' },
          right:  { style: c === 7 ? 'medium' : 'thin' },
          bottom: { style: (r === 47 || r === 8) ? 'medium' : 'thin' }
        };
      }
    }
  }
  // 48~50행 E~G열 테두리: F, G열에 요청하신 테두리 적용(가운데 두줄은 굵은선X)
  for (let r = 48; r <= 50; r++) {
    // F열
    const fCell = sheet.getCell('F' + r);
    fCell.border = {
      left: { style: 'medium' },
      right: { style: 'medium' },
      bottom: r === 50 ? { style: 'medium' } : { style: 'thin' },
      top: r === 48 ? { style: 'thin' } : undefined
    };
    // G열
    const gCell = sheet.getCell('G' + r);
    gCell.border = {
      right: { style: 'medium' },
      left: { style: 'thin' },
      bottom: r === 50 ? { style: 'medium' } : { style: 'thin' },
      top: r === 48 ? { style: 'thin' } : undefined
    };
  }

  // 9. 파일 생성
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
