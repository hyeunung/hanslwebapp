import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

/***************************************
 * CONFIG - adjust if needed
 ***************************************/
const CSV_PATH = '구매내역_clean.csv';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Supabase env vars missing');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

/***************************************
 * HELPERS
 ***************************************/
const num = (str = '') => {
  if (!str) return 0;
  // Remove commas, quotes, currency symbols, whitespace
  const cleaned = String(str).replace(/[^0-9.\-]/g, '');
  return cleaned ? Number(cleaned) : 0;
};

const parseDate = (str = '') => {
  if (!str) return null;
  // Expect formats like "2025년 5월 12일" or "2025년 5월 12일 오후 6:12"
  const match = str.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (!match) return null;
  const [_, y, m, d] = match;
  const month = m.padStart(2, '0');
  const day = d.padStart(2, '0');
  return `${y}-${month}-${day}`; // ISO date yyyy-mm-dd
};

// Ensure vendor exists; return id
async function getVendorId(vendorName) {
  if (!vendorName) return null;
  // Check existing
  const { data, error } = await supabase
    .from('vendors')
    .select('id')
    .eq('vendor_name', vendorName)
    .maybeSingle();
  if (error) throw error;
  if (data) return data.id;
  // Insert new (no unique constraint, so may duplicate—use upsert via check)
  const { data: newVendor, error: insertErr } = await supabase
    .from('vendors')
    .insert({ vendor_name: vendorName })
    .select('id')
    .single();
  if (insertErr) {
    // In case of race duplicate, reselect
    const { data: again, error: againErr } = await supabase
      .from('vendors')
      .select('id')
      .eq('vendor_name', vendorName)
      .maybeSingle();
    if (againErr || !again) throw insertErr;
    return again.id;
  }
  return newVendor.id;
}

async function insertVendorContactIfAny({ vendor_id, contact_email }) {
  if (!contact_email) return;
  // naive check for existing
  const { data: existing, error } = await supabase
    .from('vendor_contacts')
    .select('id')
    .eq('vendor_id', vendor_id)
    .eq('contact_email', contact_email)
    .maybeSingle();
  if (error) throw error;
  if (existing) return;
  await supabase.from('vendor_contacts').insert({
    vendor_id,
    contact_email,
    contact_name: '',
    position: '',
    is_primary: true,
  });
}

async function getPurchaseRequestId(orderNo) {
  const { data, error } = await supabase
    .from('purchase_requests')
    .select('id')
    .eq('purchase_order_number', orderNo)
    .maybeSingle();
  if (error) throw error;
  return data ? data.id : null;
}

let employeeCache = new Map();

async function loadEmployees() {
  const { data, error } = await supabase.from('employees').select('id, name');
  if (error) throw error;
  data.forEach((e) => {
    if (e.name) employeeCache.set(e.name.trim(), e.id);
  });
}

function getEmployeeIdByName(name) {
  if (!name) return null;
  return employeeCache.get(name.trim()) || null;
}

/***************************************
 * MAIN
 ***************************************/
(async () => {
  await loadEmployees();
  console.log('📥 Reading CSV...');
  const csvRaw = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parse(csvRaw, { columns: true });

  // Group by 발주번호
  const byOrder = rows.reduce((acc, row) => {
    const key = row['발주번호']?.trim();
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const orderNos = Object.keys(byOrder);
  console.log(`📝 ${orderNos.length} purchase orders found`);

  for (const orderNo of orderNos) {
    try {
      const items = byOrder[orderNo];
      if (!items || items.length === 0) continue;

      const sample = items[0];
      let vendorName = sample['구매업체']?.trim();
      if (!vendorName) vendorName = '미지정';
      const vendor_id = await getVendorId(vendorName);
      await insertVendorContactIfAny({ vendor_id, contact_email: sample['이메일(추출용)']?.trim() });

      // Aggregate total amount
      const total_amount = items.reduce((sum, r) => sum + num(r['합계금액']), 0);

      const requesterName = sample['구매요구자']?.trim();
      const requester_id = getEmployeeIdByName(requesterName);
      // requester_id may be null; allowed

      const statusKey = Object.keys(sample).find((k) => k.replace(/^\uFEFF/, '') === '배송상태');
      const statusText = statusKey ? (sample[statusKey]?.trim() || '') : '';
      const is_received = statusText.includes('완료'); // true for '입고 완료', false otherwise

      // Check if request already exists
      const existingId = await getPurchaseRequestId(orderNo);
      if (existingId) {
        // Update is_received if needed
        const { error: updErr } = await supabase
          .from('purchase_requests')
          .update({ is_received })
          .eq('id', existingId);
        if (updErr) {
          console.error(`⚠️  Failed to update is_received for ${orderNo}:`, updErr.message);
        } else {
          console.log(`⏭️  ${orderNo} already exists (id=${existingId}), is_received updated`);
        }
        continue;
      }

      const purchaseRequest = {
        purchase_order_number: orderNo,
        request_date: parseDate(sample['청구일']),
        delivery_request_date: parseDate(sample['입고 요청일']),
        progress_type: sample['진행 종류'] || '',
        payment_category: '발주',
        currency: 'KRW',
        total_amount,
        unit_price_currency: 'KRW',
        vendor_id,
        requester_name: requesterName,
        requester_id,
        project_vendor: sample['PJ업체']?.trim() || null,
        sales_order_number: sample['수주번호']?.trim() || null,
        project_item: sample['ITEM']?.trim() || null,
        po_template_type: 'default',
        final_manager_status: 'approved',
        middle_manager_status: 'approved',
        request_type: '원자재',
        is_received,
      };

      // Transaction per order: PostgREST doesn't support multi-stmt; we'll do best-effort.
      const { data: prData, error: prErr } = await supabase
        .from('purchase_requests')
        .insert(purchaseRequest)
        .select('id')
        .single();
      if (prErr) {
        console.error(`❌ Failed to insert purchase_request for ${orderNo}:`, prErr.message);
        continue;
      }
      const purchase_request_id = prData.id;

      // Build item rows
      const itemRows = items.map((r, idx) => ({
        purchase_request_id,
        line_number: idx + 1,
        item_name: r['품명']?.trim(),
        specification: r['규격']?.trim() || null,
        quantity: num(r['수량']),
        unit_price_value: num(r['단가']),
        unit_price_currency: 'KRW',
        amount_value: num(r['합계금액']),
        amount_currency: 'KRW',
        remark: r['비고(사용 용도)']?.trim() || null,
        vendor_name: vendorName,
        purchase_order_number: orderNo,
        requester_name: r['구매요구자']?.trim(),
      }));

      const { error: itemsErr } = await supabase.from('purchase_request_items').insert(itemRows);
      if (itemsErr) {
        console.error(`❌ Failed inserting items for ${orderNo}:`, itemsErr.message);
        // Optionally rollback pr, but skipping for simplicity
        continue;
      }

      console.log(`✅ Imported ${orderNo}: ${items.length} items, total ${total_amount}`);
    } catch (err) {
      console.error(`❌ Unexpected error processing ${orderNo}:`, err);
    }
  }

  console.log('🎉 Import completed');
})(); 