// [Supabase 클라이언트 인스턴스 생성 파일]
// 이 파일은 프론트엔드(React/Next.js 등)에서 Supabase와 통신할 때 사용할 supabase 객체를 생성합니다.
// - 프로젝트 전체에서 import { supabase } from '경로/supabaseClient' 형태로 재사용합니다.
// - 환경 변수에 Supabase 프로젝트 URL과 익명 키가 필요합니다.
// - 보안상 서비스 역할 키(SERVICE_ROLE_KEY)는 프론트엔드에서 사용하지 않습니다.
//
// 사용 예시:
//   import { supabase } from '경로/supabaseClient';
//   const { data, error } = await supabase.from('테이블명').select('*');

import { createClient } from '@supabase/supabase-js';

console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
 
export const supabase = createClient(supabaseUrl, supabaseAnonKey); 