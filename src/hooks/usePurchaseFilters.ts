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
  // [함수] 입고현황 탭에서 사용할 필터 조건
  const isReceiptTabMatch = (item: Purchase) => {
    if (item.is_received === false) {
      if (selectedEmployee !== 'all' && selectedEmployee) {
        if (item.requester_name !== selectedEmployee) return false;
      }
      const isFinalApproved = item.final_manager_status === 'approved';
      const isAdvance = item.progress_type?.includes('선진행');
      if (!(isFinalApproved || isAdvance)) return false;
      return true;
    }
    if (item.is_received === true && isToday(item.received_at)) {
      if (selectedEmployee !== 'all' && selectedEmployee) {
        if (item.requester_name !== selectedEmployee) return false;
      }
      const isFinalApproved = item.final_manager_status === 'approved';
      const isAdvance = item.progress_type?.includes('선진행');
      if (!(isFinalApproved || isAdvance)) return false;
      return true;
    }
    return false;
  };

  // [useMemo] 필터링된 발주 목록을 계산합니다.
  const tabFilteredOrders = useMemo(() => {
    if (activeTab === 'receipt') {
      return purchases.filter(isReceiptTabMatch);
    }
    if (activeTab === 'done') {
      return purchases.filter(item => {
        if (searchTerm && searchTerm.trim() !== '') {
          const term = searchTerm.trim().toLowerCase();
          const searchable = [
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
          if (!searchable.includes(term)) return false;
        }
        return true;
      });
    }
    return purchases.filter(item => {
      if (selectedEmployee !== 'all' && selectedEmployee) {
        if (item.requester_name !== selectedEmployee) return false;
      }
      if (searchTerm && searchTerm.trim() !== '') {
        const term = searchTerm.trim().toLowerCase();
        const searchable = [
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
        if (!searchable.includes(term)) return false;
      }
      if (activeTab === 'pending') {
        return item.final_manager_status !== 'approved' ||
          (item.final_manager_status === 'approved' && isToday(item.final_manager_approved_at));
      }
      if (activeTab === 'purchase') {
        return item.payment_category === '구매 요청' &&
          (!item.is_payment_completed || isToday(item.payment_completed_at));
      }
      if (activeTab === 'receipt') {
        const isFinalApproved = item.final_manager_status === 'approved';
        const isAdvance = item.progress_type?.includes('선진행');
        if (!(isFinalApproved || isAdvance)) return false;
        return item.progress_type !== '입고완료' ||
          (item.progress_type === '입고완료' && isToday(item.received_at));
      }
      if (activeTab === 'done') {
        return ['approved', '승인'].includes(item.final_manager_status || '');
      }
      return true;
    });
  }, [purchases, activeTab, searchTerm, selectedEmployee, isToday]);

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
    Object.entries(orderNumberGroups).forEach(([orderNumber, items]) => {
      if (items.length > 1) {
        const headerItem = {
          ...items[0],
          isGroupHeader: true,
          groupSize: items.length
        };
        result.push(headerItem);
        if (headerItem && headerItem.purchase_order_number) {
          items.slice(1).forEach((item, index) => {
            result.push({
              ...item,
              isSubItem: true,
              isLastSubItem: index === items.length - 2
            });
          });
        }
      } else {
        result.push({
          ...items[0],
          isGroupHeader: true,
          groupSize: 1
        });
      }
    });
    return result;
  }, [orderNumberGroups]);

  // 훅에서 가공된 데이터 반환
  return {
    tabFilteredOrders, // 필터링된 발주 목록
    orderNumberGroups, // 발주번호별 그룹핑 데이터
    displayData, // 테이블에 표시할 최종 데이터
  };
}
