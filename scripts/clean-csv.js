import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

// 입력 CSV 파일 경로
const INPUT_PATH = '구매내역.csv';
// 출력 CSV 파일 경로
const OUTPUT_PATH = '구매내역_clean.csv';

// CSV 읽기
const csvRaw = fs.readFileSync(INPUT_PATH, 'utf8');

// 파싱 (열 헤더 유지)
const records = parse(csvRaw, {
  columns: true,
  skip_empty_lines: false,
});

// 괄호 안 주소 제거 함수
function stripParen(text = '') {
  return text.replace(/\s*\(.*?\)/g, '').trim();
}

// 각 레코드 처리
for (const row of records) {
  if (row['구매업체']) row['구매업체'] = stripParen(row['구매업체']);
  if (row['구매요구자']) row['구매요구자'] = stripParen(row['구매요구자']);
}

// 다시 CSV 문자열로 변환
const output = stringify(records, {
  header: true,
});

// 결과 저장
fs.writeFileSync(OUTPUT_PATH, output, 'utf8');
console.log(`정리된 파일이 ${OUTPUT_PATH} 에 저장되었습니다.`); 