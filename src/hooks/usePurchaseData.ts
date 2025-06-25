// usePurchaseData.ts
// 이 파일은 "발주(구매) 목록"과 "직원 목록"을 불러오고, 현재 로그인한 사용자의 이름/권한 정보를 관리하는 커스텀 훅입니다.
// 화면에서 발주 목록, 직원 선택, 권한 체크 등에 필요한 모든 데이터와 함수를 제공합니다.
// 비전공자도 이해할 수 있도록 각 부분에 한글로 상세 주석을 추가했습니다.

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/providers/AuthProvider";

// [타입 정의] 발주(구매) 데이터의 구조를 설명합니다.
export interface Purchase {
  id: number; // 발주 요청 고유번호
  purchase_order_number?: string; // 발주서 번호
  request_date: string; // 발주 요청일
  delivery_request_date: string; // 입고 요청일
  progress_type: string; // 진행 상태(예: 대기, 승인 등)
  is_payment_completed: boolean; // 결제 완료 여부
  payment_category: string; // 결제 종류(구매 요청 등)
  currency: string; // 통화 단위
  request_type: string; // 요청 유형
  vendor_name: string; // 업체명
  vendor_payment_schedule: string; // 업체 결제 조건
  requester_name: string; // 구매 요청자 이름
  item_name: string; // 품명
  specification: string; // 규격
  quantity: number; // 수량
  unit_price_value: number; // 단가
  amount_value: number; // 합계
  remark: string; // 비고
  project_vendor: string; // PJ업체
  sales_order_number: string; // 수주번호
  project_item: string; // 프로젝트 아이템
  line_number: number; // 발주서 내 라인 번호
  contact_name?: string; // 업체 담당자명
  middle_manager_status?: string; // 중간 관리자 승인 상태
  final_manager_status?: string; // 최종 관리자 승인 상태
  payment_completed_at: string; // 결제 완료일
  is_received: boolean; // 입고 완료 여부
  received_at: string; // 입고 완료일
  final_manager_approved_at?: string | null; // 최종 승인일
  link?: string; // 구매 요청 링크
}

// [타입 정의] 직원 데이터의 구조를 설명합니다.
export interface Employee {
  name: string; // 직원 이름
  email: string; // 직원 이메일
  purchase_role?: string[]; // 구매 관련 권한(예: app_admin 등)
}

// [커스텀 훅] 발주/직원 데이터와 현재 사용자 정보를 관리합니다.
export function usePurchaseData() {
  const { user } = useAuth(); // 현재 로그인한 사용자 정보
  // 발주(구매) 목록 상태
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  // 직원 목록 상태
  const [employees, setEmployees] = useState<Employee[]>([]);
  // 현재 로그인한 사용자의 이름
  const [currentUserName, setCurrentUserName] = useState<string>("");
  // 현재 로그인한 사용자의 권한(역할)
  const [currentUserRoles, setCurrentUserRoles] = useState<string[]>([]);
  // 현재 로그인한 사용자의 직원관리 role
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  // 직원 목록 로딩 중 여부
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  // 발주 목록 로딩 중 여부
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(true);

  // [초기 데이터 로딩] 사용자가 로그인하면 발주/직원 데이터를 불러옵니다.
  useEffect(() => {
    if (user?.id) {
      loadMyRequests();
      loadEmployees();
    }
    // eslint-disable-next-line
  }, [user?.id]);

  // [함수] 발주(구매) 목록을 Supabase에서 불러옵니다.
  async function loadMyRequests() {
    if (!user) return;
    setIsLoadingPurchases(true);
    try {
      // purchase_request_view(뷰)에서 필요한 필드만 선택해서 가져옵니다.
      const { data, error } = await supabase
        .from('purchase_request_view')
        .select(`
          purchase_request_id,
          purchase_order_number,
          request_date,
          delivery_request_date,
          progress_type,
          is_payment_completed,
          payment_completed_at,
          payment_category,
          currency,
          request_type,
          vendor_name,
          vendor_payment_schedule,
          requester_name,
          item_name,
          specification,
          quantity,
          unit_price_value,
          amount_value,
          remark,
          project_vendor,
          sales_order_number,
          project_item,
          line_number,
          contact_name,
          middle_manager_status,
          final_manager_status,
          is_received,
          received_at,
          is_payment_completed,
          link
        `)
        .order('request_date', { ascending: false });
      if (data) {
        // 받아온 데이터를 Purchase 타입에 맞게 변환하여 상태에 저장합니다.
        setPurchases(
          (data as Array<Record<string, unknown>>).map((row) => ({
            id: Number(row.purchase_request_id),
            purchase_order_number: row.purchase_order_number as string,
            request_date: row.request_date as string,
            delivery_request_date: row.delivery_request_date as string,
            progress_type: row.progress_type as string,
            payment_completed_at: row.payment_completed_at as string,
            payment_category: row.payment_category as string,
            currency: row.currency as string,
            request_type: row.request_type as string,
            vendor_name: row.vendor_name as string,
            vendor_payment_schedule: row.vendor_payment_schedule as string,
            requester_name: row.requester_name as string,
            item_name: row.item_name as string,
            specification: row.specification as string,
            quantity: Number(row.quantity),
            unit_price_value: Number(row.unit_price_value),
            amount_value: Number(row.amount_value),
            remark: row.remark as string,
            project_vendor: row.project_vendor as string,
            sales_order_number: row.sales_order_number as string,
            project_item: row.project_item as string,
            line_number: Number(row.line_number),
            contact_name: row.contact_name ? String(row.contact_name) : '',
            middle_manager_status: row.middle_manager_status as string,
            final_manager_status: row.final_manager_status as string,
            is_received: !!row.is_received,
            received_at: row.received_at as string,
            is_payment_completed: !!row.is_payment_completed,
            link: row.link as string | undefined,
          }))
        );
      }
    } catch (error) {
      // 에러 발생 시 콘솔에 출력
      console.error('발주 데이터 로딩 오류:', error);
    } finally {
      setIsLoadingPurchases(false); // 로딩 상태 해제
    }
  }

  // [함수] 직원 목록과 현재 사용자 정보를 Supabase에서 불러옵니다.
  async function loadEmployees() {
    if (!user) {
      setIsLoadingEmployees(false);
      return;
    }
    setIsLoadingEmployees(true);
    try {
      // 1. 현재 로그인한 사용자를 ID로 찾기
      let { data: currentUser, error: userError } = await supabase
        .from('employees')
        .select('name, email, purchase_role, role')
        .eq('id', user.id)
        .single();
      // 2. ID로 못 찾으면 이메일로 재시도
      if (!currentUser && user.email) {
        const { data: userByEmail, error: emailError } = await supabase
          .from('employees')
          .select('name, email, purchase_role, role')
          .eq('email', user.email)
          .single();
        if (userByEmail) {
          currentUser = userByEmail;
        }
        userError = emailError;
      }
      // 3. 사용자 정보 상태에 저장
      if (currentUser) {
        setCurrentUserName(currentUser.name);
        setCurrentUserRoles(currentUser.purchase_role || []);
        setCurrentUserRole(currentUser.role || "");
      } else {
        // 이메일에서 이름 추출(없으면 기본값)
        if (user.email) {
          const nameFromEmail = user.email.split('@')[0];
          setCurrentUserName(nameFromEmail);
        } else {
          setCurrentUserName('기본사용자');
        }
        setCurrentUserRoles([]);
        setCurrentUserRole("");
        if (userError) console.error('현재 사용자 정보 로딩 오류:', userError.message);
      }
      // 4. 전체 직원 목록 불러오기
      const { data: employeeList, error: listError } = await supabase
        .from('employees')
        .select('name, email, purchase_role')
        .order('name');
      if (listError) throw listError;
      if (employeeList && employeeList.length > 0) {
        setEmployees(employeeList);
      } else {
        setEmployees([{ name: currentUser?.name || user.email?.split('@')[0] || '기본사용자', email: currentUser?.email || user.email || '', purchase_role: currentUser?.purchase_role || [] }]);
      }
    } catch (error) {
      // 에러 발생 시 콘솔에 출력 및 기본값 설정
      console.error('직원 정보를 불러오는데 실패했습니다:', error);
      setCurrentUserName(user.email?.split('@')[0] || '기본사용자');
      setCurrentUserRoles([]);
      setCurrentUserRole("");
      setEmployees([{ name: user.email?.split('@')[0] || '기본사용자', email: user.email || '' }]);
    } finally {
      setIsLoadingEmployees(false); // 로딩 상태 해제
    }
  }

  // 이 훅이 반환하는 값(상태와 함수들)
  return {
    purchases, // 발주(구매) 목록
    employees, // 직원 목록
    currentUserName, // 현재 사용자 이름
    currentUserRoles, // 현재 사용자 권한
    currentUserRole, // 현재 사용자 직원관리 role
    isLoadingEmployees, // 직원 목록 로딩 중 여부
    isLoadingPurchases, // 발주 목록 로딩 중 여부
    loadMyRequests, // 발주 목록 새로고침 함수
    loadEmployees, // 직원 목록 새로고침 함수
  };
}
