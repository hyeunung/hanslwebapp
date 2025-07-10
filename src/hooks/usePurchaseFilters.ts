// usePurchaseFilters.ts
// 이 파일은 발주(구매) 목록 데이터를 다양한 조건(탭, 검색어, 직원 등)으로 필터링하고,
// 발주번호별로 그룹핑/가공하는 로직을 커스텀 훅으로 제공합니다.
// 비전공자도 이해할 수 있도록 각 부분에 한글로 상세 주석을 추가했습니다.

import { useMemo } from "react";
import { Purchase } from "@/hooks/usePurchaseData";

// [타입 정의] 필터링에 필요한 주요 파라미터
interface UsePurchaseFiltersProps {
  purchases: Purchase[]; // 전체 발주(구매) 목록
  activeTab: string; // 현재 선택된 탭(예: 'pending', 'purchase', 'receipt', 'done')
  searchTerm: string; // 검색어
  selectedEmployee: string; // 선택된 직원 이름
  isToday: (dateStr?: string | null) => boolean; // 오늘 날짜인지 판별하는 함수
}

// [커스텀 훅] 발주 목록을 다양한 조건으로 필터링/가공합니다.
export function usePurchaseFilters({ purchases, activeTab, searchTerm, selectedEmployee, isToday }: UsePurchaseFiltersProps) {
  // [useMemo] 필터링된 발주 목록을 계산합니다.
  const tabFilteredOrders = useMemo(() => {
    const matchesSearchAndEmployee = (item: Purchase) => {
      if (selectedEmployee && selectedEmployee !== 'all' && item.requester_name !== selectedEmployee) return false;
      if (searchTerm && searchTerm.trim() !== '') {
        const term = searchTerm.trim().toLowerCase();
        
        // 기본 발주 정보 검색
        const baseSearchable = [
          item.purchase_order_number,
          item.vendor_name,
          item.item_name,
          item.specification,
          item.requester_name,
          item.remark,
          item.project_vendor,
          item.sales_order_number,
          item.project_item,
          item.unit_price_value?.toString(),
          item.unit_price_value ? Number(item.unit_price_value).toLocaleString() : '',
          item.amount_value?.toString(),
          item.amount_value ? Number(item.amount_value).toLocaleString() : '',
        ].map(v => (v || '').toLowerCase()).join(' ');
        
        // 모든 품목 상세정보 검색 (items 배열)
        const allItemsSearchable = (item.items || []).map(subItem => [
          subItem.item_name,
          subItem.specification,
          subItem.remark,
          subItem.link,
          subItem.unit_price_value?.toString(),
          subItem.unit_price_value ? Number(subItem.unit_price_value).toLocaleString() : '',
          subItem.amount_value?.toString(),
          subItem.amount_value ? Number(subItem.amount_value).toLocaleString() : '',
        ].map(v => (v || '').toLowerCase()).join(' ')).join(' ');
        
        // 기본 정보 또는 품목 상세정보 중 하나라도 일치하면 표시
        const combinedSearchable = baseSearchable + ' ' + allItemsSearchable;
        if (!combinedSearchable.includes(term)) return false;
      }
      return true;
    };

    const filtered = purchases.filter(item => {
      if (!matchesSearchAndEmployee(item)) return false;

      switch (activeTab) {
        case 'pending':
          return ['pending', '대기', '', null].includes(item.final_manager_status as any);
        case 'purchase': {
          // 조건: (1) 선진행 & 구매 요청 & 결제 미완료  OR  (2) 일반 & 구매 요청 & 결제 미완료 & 최종승인
          const isRequest = item.payment_category === '구매 요청';
          const notPaid = !item.is_payment_completed;
          if (!isRequest || !notPaid) return false;

          const isSeonJin = (item.progress_type || '').includes('선진행');
          const isIlban = (item.progress_type || '').includes('일반');
          const finalApproved = item.final_manager_status === 'approved';

          return (isSeonJin) || (isIlban && finalApproved);
        }
        case 'receipt': {
          const notReceived = !item.is_received;
          const cond = (item.progress_type || '').includes('선진행') || item.final_manager_status === 'approved';
          return notReceived && cond;
        }
        case 'done':
          return true; // 전체 항목
        default:
          return true;
      }
    });
    return filtered;
  }, [purchases, activeTab, searchTerm, selectedEmployee]);

  // [useMemo] 발주번호별로 그룹핑된 데이터 생성
  const orderNumberGroups = useMemo(() => {
    return tabFilteredOrders.reduce((acc, item) => {
      const key = item.purchase_order_number || 'no-number';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, Purchase[]>);
  }, [tabFilteredOrders]);

  // [useMemo] 실제 테이블에 표시할 데이터(그룹 헤더/하위 항목 등) 생성
  const displayData = useMemo(() => {
    const result: (Purchase & { isGroupHeader?: boolean; groupSize?: number; isSubItem?: boolean; isLastSubItem?: boolean })[] = [];
    
    tabFilteredOrders.forEach((purchase) => {
      const purchaseItems = purchase.items || [];
      
      if (purchaseItems.length > 1) {
        // 여러 품목이 있는 경우: 헤더 + 하위 항목들
        const headerItem = {
          ...purchase,
          isGroupHeader: true,
          groupSize: purchaseItems.length
        };
        result.push(headerItem);
        
        // 나머지 품목들을 하위 항목으로 추가
        purchaseItems.slice(1).forEach((item, index) => {
          result.push({
            ...purchase,
            item_name: item.item_name,
            specification: item.specification,
            quantity: item.quantity,
            unit_price_value: item.unit_price_value,
            amount_value: item.amount_value,
            remark: item.remark,
            link: item.link,
            line_number: item.line_number,
            isSubItem: true,
            isLastSubItem: index === purchaseItems.length - 2
          });
        });
      } else {
        // 품목이 하나인 경우
        result.push({
          ...purchase,
          isGroupHeader: true,
          groupSize: 1
        });
      }
    });
    
    return result;
  }, [tabFilteredOrders]);

  // 훅에서 가공된 데이터 반환
  return {
    tabFilteredOrders, // 필터링된 발주 목록
    orderNumberGroups, // 발주번호별 그룹핑 데이터
    displayData, // 테이블에 표시할 최종 데이터
  };
}
