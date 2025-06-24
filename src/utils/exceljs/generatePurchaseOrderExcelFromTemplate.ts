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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function generatePurchaseOrderExcelFromTemplate(data: PurchaseOrderData): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();

  // Load template (must reside in /public/templates)
  const res = await fetch('/templates/발주서(Default)-3.xlsx');
  if (!res.ok) throw new Error(`Template load failed: ${res.status} ${res.statusText}`);
  const buffer = await res.arrayBuffer();

  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];

  // Basic info mapping – coordinates are identical to SheetJS version
  sheet.getCell('C2').value = data.vendor_name || '';
  sheet.getCell('F2').value = data.requester_name || '';
  sheet.getCell('C3').value = data.vendor_contact_name || '';
  sheet.getCell('C4').value = formatDate(data.request_date);
  sheet.getCell('F4').value = data.purchase_order_number || '';
  sheet.getCell('C5').value = data.vendor_phone || '';
  sheet.getCell('C6').value = data.vendor_fax || '';
  sheet.getCell('C7').value = formatDate(data.delivery_request_date);

  // Items – start at row 9
  const baseRow = 9;
  data.items.forEach((item, idx) => {
    const r = baseRow + idx;
    sheet.getCell(`A${r}`).value = item.line_number || idx + 1;
    sheet.getCell(`B${r}`).value = item.item_name || '';
    sheet.getCell(`C${r}`).value = item.specification || '';
    sheet.getCell(`D${r}`).value = item.quantity || 0;
    sheet.getCell(`E${r}`).value = item.unit_price_value || 0;
    sheet.getCell(`F${r}`).value = item.amount_value || 0;
    sheet.getCell(`G${r}`).value = item.remark || '';
  });

  const totalAmount = data.items.reduce((sum, it) => sum + (it.amount_value || 0), 0);
  sheet.getCell('W47').value = totalAmount;

  sheet.getCell('G48').value = data.project_vendor || '';
  sheet.getCell('G49').value = data.sales_order_number || '';
  sheet.getCell('G50').value = data.project_item || '';

  // Produce blob
  const outBuffer = await workbook.xlsx.writeBuffer({ useStyles: true, useSharedStrings: true });
  return new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
} 