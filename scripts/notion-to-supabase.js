// Notion → Supabase 벤더 이관 스크립트
const { Client } = require('@notionhq/client');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = '19ac640ccca480bf9397ecc476df4432';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // 1. Notion에서 데이터 읽기
  const pages = await notion.databases.query({ database_id: databaseId, page_size: 100 });
  for (const page of pages.results) {
    // Notion 속성명 그대로 사용
    const vendor_name = page.properties['구매업체']?.title?.[0]?.plain_text || '';
    const vendor_phone = page.properties['TEL']?.phone_number || '';
    const vendor_fax = page.properties['FAX']?.phone_number || '';
    const vendor_payment_schedule = page.properties['지출 예정일']?.select?.name || '';

    // vendors 테이블에 insert
    const { data: vendorData, error: vendorError } = await supabase
      .from('vendors')
      .insert({ vendor_name, vendor_phone, vendor_fax, vendor_payment_schedule })
      .select('id')
      .single();
    if (vendorError) {
      console.error('Vendor insert error:', vendorError, vendor_name);
      continue;
    }
    // 이메일1~이메일4까지 vendor_contacts에 각각 등록
    const emailFields = ['이메일1', '이메일2', '이메일3', '이메일4'];
    for (const field of emailFields) {
      const contact_email = page.properties[field]?.email || '';
      if (contact_email) {
        await supabase.from('vendor_contacts').insert({
          vendor_id: vendorData.id,
          contact_name: '',
          contact_email,
          contact_phone: '',
          position: '',
        });
      }
    }
    console.log('이관 완료:', vendor_name);
  }
  console.log('모든 이관 완료!');
}

main().catch(console.error); 