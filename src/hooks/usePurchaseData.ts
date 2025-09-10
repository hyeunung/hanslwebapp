// usePurchaseData.ts
// 이 파일은 "발주(구매) 목록"과 "직원 목록"을 불러오고, 현재 로그인한 사용자의 이름/권한 정보를 관리하는 커스텀 훅입니다.
// 화면에서 발주 목록, 직원 선택, 권한 체크 등에 필요한 모든 데이터와 함수를 제공합니다.
// 비전공자도 이해할 수 있도록 각 부분에 한글로 상세 주석을 추가했습니다.

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/providers/AuthProvider";

// [타입 정의] 품목 데이터 구조
export interface PurchaseItem {
  line_number: number;
  item_name: string;
  specification: string;
  quantity: number;
  unit_price_value: number;
  amount_value: number;
  remark: string;
  link?: string;
}

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
  item_name: string; // 품명 (첫 번째 품목)
  specification: string; // 규격 (첫 번째 품목)
  quantity: number; // 수량 (첫 번째 품목)
  unit_price_value: number; // 단가 (첫 번째 품목)
  amount_value: number; // 합계 (첫 번째 품목)
  remark: string; // 비고 (첫 번째 품목)
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
  is_po_download?: boolean; // 발주서 다운로드 여부 표시
  link?: string; // 구매 요청 링크 (첫 번째 품목)
  items?: PurchaseItem[]; // 전체 품목 리스트
}

// [타입 정의] 직원 데이터의 구조를 설명합니다.
export interface Employee {
  name: string; // 직원 이름
  email: string; // 직원 이메일
  purchase_role?: string[]; // 구매 관련 권한(예: app_admin 등)
}

// [커스텀 훅] 발주/직원 데이터와 현재 사용자 정보를 관리합니다.
export function usePurchaseData() {
  const { user, loading } = useAuth(); // 현재 로그인한 사용자 정보
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

  // [함수] 발주(구매) 목록을 Supabase에서 불러옵니다. (효율적인 조인 쿼리 방식)
  async function loadMyRequests() {
    if (!user) return;
    setIsLoadingPurchases(true);
    try {
      // 한 번의 쿼리로 모든 관련 데이터 조회 (nested select 사용)
      const { data: requests, error: requestsError } = await supabase
        .from('purchase_requests')
        .select(`
          *,
          vendors (
            vendor_name,
            vendor_payment_schedule
          ),
          vendor_contacts (
            contact_name
          ),
          purchase_request_items (
            item_name,
            specification,
            quantity,
            unit_price_value,
            amount_value,
            remark,
            line_number,
            link
          )
        `)
        .order('request_date', { ascending: false })
        .limit(2000);

      if (requestsError) throw requestsError;
      
      
      // 데이터 변환 및 Purchase 객체 생성
      const purchases: Purchase[] = (requests || []).map((request: any) => {
        // 첫 번째 품목 정보 (기존 방식과 호환성 유지)
        const firstItem = request.purchase_request_items?.[0] || {};
        
        return {
          id: Number(request.id),
          purchase_order_number: request.purchase_order_number as string,
          request_date: request.request_date as string,
          delivery_request_date: request.delivery_request_date as string,
          progress_type: request.progress_type as string,
          payment_completed_at: request.payment_completed_at as string,
          payment_category: request.payment_category as string,
          currency: request.currency as string,
          request_type: request.request_type as string,
          vendor_name: request.vendors?.vendor_name || '',
          vendor_payment_schedule: request.vendors?.vendor_payment_schedule || '',
          requester_name: request.requester_name as string,
          item_name: firstItem.item_name as string || '',
          specification: firstItem.specification as string || '',
          quantity: Number(firstItem.quantity) || 0,
          unit_price_value: Number(firstItem.unit_price_value) || 0,
          amount_value: Number(firstItem.amount_value) || 0,
          remark: firstItem.remark as string || '',
          project_vendor: request.project_vendor as string,
          sales_order_number: request.sales_order_number as string,
          project_item: request.project_item as string,
          line_number: Number(firstItem.line_number) || 1,
          contact_name: request.vendor_contacts?.contact_name || '',
          middle_manager_status: request.middle_manager_status as string,
          final_manager_status: request.final_manager_status as string,
          is_received: !!request.is_received,
          received_at: request.received_at as string,
          is_payment_completed: !!request.is_payment_completed,
          is_po_download: !!request.is_po_download,
          link: firstItem.link as string | undefined,
          // 전체 품목 리스트 추가
          items: request.purchase_request_items || []
        };
      });
      
      setPurchases(purchases);
    } catch (error) {
      // 에러 발생 시 콘솔에 출력
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
