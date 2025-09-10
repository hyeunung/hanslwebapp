// PurchaseTable.tsx
// 이 컴포넌트는 발주(구매) 목록 테이블을 렌더링합니다.
// 비전공자도 이해할 수 있도록 한글로 상세 주석을 추가했습니다.
// props로 받은 데이터(displayData 등)를 표 형태로 보여주며,
// 행 클릭, 엑셀 다운로드 등 주요 상호작용도 이 컴포넌트에서 처리합니다.

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import dynamic from "next/dynamic";
const ReactSelect = dynamic(() => import('react-select'), { ssr: false });

// 각 발주(구매) 항목의 데이터 구조입니다. 실제로 코드를 수정할 일은 거의 없습니다.
export interface PurchaseTableItem {
  purchase_order_number?: string;
  line_number?: number;
  request_date: string;
  delivery_request_date: string;
  progress_type: string;
  is_payment_completed: boolean;
  payment_category: string;
  currency: string;
  request_type: string;
  vendor_name: string;
  vendor_payment_schedule: string;
  requester_name: string;
  item_name: string;
  specification: string;
  quantity: number;
  unit_price_value: number;
  amount_value: number;
  remark: string;
  project_vendor: string;
  sales_order_number: string;
  project_item: string;
  contact_name?: string;
  middle_manager_status?: string;
  final_manager_status?: string;
  payment_completed_at?: string;
  is_received: boolean;
  received_at?: string;
  final_manager_approved_at?: string | null;
  is_po_download?: boolean;
  // 그룹/하위 항목 표시용
  isGroupHeader?: boolean;
  groupSize?: number;
  isSubItem?: boolean;
  isLastSubItem?: boolean;
  link?: string;
}

// 편집 가능한 필드들의 타입 정의
interface EditableFields {
  item_name: string;
  specification: string;
  quantity: number;
  unit_price_value: number;
  remark: string;
  delivery_request_date: string;
  link?: string;
  vendor_id?: number;
  vendor_contacts?: string[];
}

// 이 컴포넌트가 화면에 표를 그릴 때 필요한 입력값(데이터, 함수 등) 목록입니다.
interface PurchaseTableProps {
  displayData: PurchaseTableItem[];
  activeTab: string;
  expandedGroups: Set<string>;
  currentUserName: string;
  currentUserRoles: string[];
  pressedOrder: string | null;
  toggleGroup: (orderNumber: string) => void;
  generateExcelForOrder: (orderNumber: string) => Promise<void>;
  handleCompleteReceipt: (orderNumber: string) => Promise<void>;
  setPressedOrder: (orderNumber: string | null) => void;
  handleCompletePayment: (orderNumber: string) => Promise<void>;
  handleDeleteOrder: (orderNumber: string) => Promise<void>;
  handleEditOrder: (orderNumber: string, lineNumber: number, editedFields: EditableFields) => Promise<void>;
  handleDeleteItem: (orderNumber: string, lineNumber: number) => Promise<void>;
  refreshData: () => Promise<void>; // 데이터 새로고침 함수 추가
}

// 공통 Pill 렌더러
const renderPill = (status?: string) => (
  <span
    className={`inline-block px-2 py-1 rounded-lg font-semibold ${status === 'approved' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-800'}`}
    style={{ minWidth: 40, boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)' }}
  >
    {status === 'pending' ? '대기' : status === 'approved' ? '승인' : status}
  </span>
);

// 중간/최종 상태를 나란히 중앙 정렬로 나타내는 컴포넌트
const StatusPair: React.FC<{ mid?: string; final?: string }> = ({ mid = 'pending', final = 'pending' }) => (
  <div className="flex items-center justify-center gap-1">
    {renderPill(mid)}
    <span className="text-xs font-semibold">/</span>
    {renderPill(final)}
  </div>
);

// 이 함수가 실제로 표(테이블)를 화면에 그려줍니다.
const PurchaseTable: React.FC<PurchaseTableProps> = ({
  displayData,
  activeTab,
  expandedGroups,
  currentUserName,
  currentUserRoles,
  pressedOrder,
  toggleGroup,
  generateExcelForOrder,
  handleCompleteReceipt,
  setPressedOrder,
  handleCompletePayment,
  handleDeleteOrder,
  handleEditOrder,
  handleDeleteItem,
  refreshData,
}) => {
  // 편집 상태 관리 - 발주번호 단위로 다중 편집
  const [editingOrderNumber, setEditingOrderNumber] = useState<string | null>(null); // 편집 중인 발주번호
  const [editValues, setEditValues] = useState<Record<string, EditableFields>>({}); // "발주번호-라인번호" : EditableFields
  // '구매현황'과 '전체 항목' 탭일 때 링크 열 표시
  const showLinkColumn = activeTab === 'purchase' || activeTab === 'done';
  
  // 업체와 담당자 데이터
  const [vendors, setVendors] = useState<{ id: number; vendor_name: string }[]>([]);
  const [vendorContacts, setVendorContacts] = useState<{ id: number; vendor_id: number; contact_name: string; contact_email: string; contact_phone: string; position: string }[]>([]);
  
  // 업체와 담당자 데이터 로드
  useEffect(() => {
    const loadVendorsAndContacts = async () => {
      // 업체 목록 가져오기
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id, vendor_name')
        .order('vendor_name');
      
      if (vendorData) {
        setVendors(vendorData);
      }
      
      // 담당자 목록 가져오기
      const { data: contactData } = await supabase
        .from('vendor_contacts')
        .select('id, vendor_id, contact_name, contact_email, contact_phone, position')
        .order('contact_name');
      
      if (contactData) {
        setVendorContacts(contactData);
      }
    };
    
    loadVendorsAndContacts();
  }, []);

  // 날짜를 '월-일' 형식으로 바꿔주는 함수입니다. (예: 2024-06-01 → 06-01)
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // 숫자에 통화(원, 달러 등) 기호를 붙여주는 함수입니다.
  const formatCurrency = (value: number, currency: string) => {
    const formatter = new Intl.NumberFormat('ko-KR');
    const currencySymbols: { [key: string]: string } = {
      'KRW': '₩',
      'USD': '$',
      'EUR': '€',
      'JPY': '¥',
      'CNY': '¥'
    };
    const symbol = currencySymbols[currency] || currency;
    return `${formatter.format(value)} ${symbol}`;
  };

  // '선진행' 여부를 확인하는 함수입니다. (특정 행에 색상 강조 등)
  const isAdvancePayment = (progress_type?: string) => {
    return progress_type === '선진행' || progress_type?.trim() === '선진행' || progress_type?.includes('선진행');
  };

  const canCompletePayment = currentUserRoles.includes('app_admin') || currentUserRoles.includes('ceo') || currentUserRoles.includes('purchase_manager');
  const canDelete = currentUserRoles.includes('final_approver') || currentUserRoles.includes('app_admin') || currentUserRoles.includes('ceo');
  const canEdit = currentUserRoles.includes('final_approver') || currentUserRoles.includes('app_admin') || currentUserRoles.includes('ceo');

  // 편집 모드 시작 - 발주번호 전체 편집 모드
  const startEditing = (item: PurchaseTableItem) => {
    if (!item.purchase_order_number) return;
    
    
    // 1. 그룹 자동 펼치기 (이미 열려있지 않은 경우만)
    const isAlreadyExpanded = expandedGroups.has(item.purchase_order_number);
    
    // 2. 편집 중인 발주번호 설정
    setEditingOrderNumber(item.purchase_order_number);
    
    // 3. 그룹 펼치기와 편집 데이터 설정
    const setupEditData = () => {
      const orderItems = displayData.filter(d => d.purchase_order_number === item.purchase_order_number);
      
      const newEditValues: Record<string, EditableFields> = {};
      
      orderItems.forEach(orderItem => {
        if (orderItem.line_number !== undefined) {
          const editKey = `${orderItem.purchase_order_number}-${orderItem.line_number}`;
          newEditValues[editKey] = {
            item_name: orderItem.item_name,
            specification: orderItem.specification,
            quantity: orderItem.quantity,
            unit_price_value: orderItem.unit_price_value,
            remark: orderItem.remark,
            delivery_request_date: orderItem.delivery_request_date,
            link: orderItem.link || '',
          };
        }
      });
      
      setEditValues(newEditValues);
    };
    
    if (!isAlreadyExpanded) {
      toggleGroup(item.purchase_order_number);
      // 그룹이 펼쳐진 후 편집 데이터 설정
      setTimeout(setupEditData, 100);
    } else {
      // 이미 펼쳐져 있으면 즉시 설정
      setupEditData();
    }
  };

  // 편집 취소
  const cancelEditing = () => {
    setEditingOrderNumber(null);
    setEditValues({});
  };

  // 편집 저장 - 발주번호의 모든 품목 일괄 저장
  const saveEditing = async () => {
    if (!editingOrderNumber) {
      return;
    }
    
    // 저장 전 상태 스냅샷 - 무엇이 저장되는지 상세 확인
    
    // editValues가 비어있는지 확인
    if (Object.keys(editValues).length === 0) {
      alert('저장할 수정 내용이 없습니다.');
      return;
    }
    
    try {
      // 해당 발주번호의 모든 품목을 순차적으로 저장
      const savePromises = Object.entries(editValues).map(async ([editKey, values]) => {
        const [orderNumber, lineNumber] = editKey.split('-');
        if (orderNumber === editingOrderNumber) {
          await handleEditOrder(orderNumber, parseInt(lineNumber), values);
        }
      });
      
      await Promise.all(savePromises);
      
      // 편집 모드 먼저 종료 - 리렌더링 충돌 방지
      setEditingOrderNumber(null);
      setEditValues({});
      
      // 모든 저장 완료 후 한 번만 알림
      alert('수정이 성공적으로 저장되었습니다!');
      
      // 데이터 새로고침 - 편집 모드 종료 후
      await refreshData();
      
    } catch (error) {
      alert(`수정 저장에 실패했습니다: ${error}`);
    }
  };

  // 편집 가능 조건 체크 - 발주 요청된 모든 항목 수정 가능
  const canEditItem = (_item: PurchaseTableItem) => {
    // 권한 체크만 - app_admin, final_approver, ceo만 수정 가능
    return canEdit;
  };

  // 현재 편집 중인지 확인
  const isCurrentlyEditing = (item: PurchaseTableItem) => {
    return editingOrderNumber === item.purchase_order_number;
  };
  
  // 특정 품목의 편집값 가져오기 (null 방지)
  const getEditValue = (item: PurchaseTableItem) => {
    const editKey = `${item.purchase_order_number}-${item.line_number}`;
    const values = editValues[editKey] || {} as EditableFields;
    
    // 현재 vendor_id 찾기 (vendor_name으로부터)
    const currentVendorId = vendors.find(v => v.vendor_name === item.vendor_name)?.id;
    
    // 현재 contacts 찾기 (contact_name으로부터) 
    const currentContacts = item.contact_name 
      ? [vendorContacts.find(c => c.contact_name === item.contact_name && c.vendor_id === currentVendorId)?.id?.toString()].filter(Boolean)
      : [];
    
    return {
      item_name: values.item_name ?? item.item_name ?? '',
      specification: values.specification ?? item.specification ?? '',
      quantity: values.quantity ?? item.quantity ?? 0,
      unit_price_value: values.unit_price_value ?? item.unit_price_value ?? 0,
      remark: values.remark ?? item.remark ?? '',
      delivery_request_date: values.delivery_request_date ?? item.delivery_request_date ?? '',
      link: values.link ?? item.link ?? '',
      vendor_id: values.vendor_id ?? currentVendorId,
      vendor_contacts: values.vendor_contacts ?? currentContacts
    };
  };
  
  // 특정 품목의 편집값 업데이트
  const updateEditValue = (item: PurchaseTableItem, field: keyof EditableFields, value: any) => {
    const editKey = `${item.purchase_order_number}-${item.line_number}`;
    setEditValues(prev => ({
      ...prev,
      [editKey]: {
        ...prev[editKey],
        [field]: value
      }
    }));
  };

  // 아래가 실제로 표(테이블)를 그리는 부분입니다.
  // 1. thead: 표의 맨 위(제목줄)
  // 2. tbody: 실제 데이터 행들
  // 각 행/열, 색상, 클릭 동작 등도 쉽게 설명하는 주석이 달려 있습니다.
  return (
    <table className="w-full min-w-max table-auto">
      <thead className="bg-muted/10 sticky top-0 border-t border-border">
        <tr className="h-12">
          {/* 탭(진행상태)에 따라 표의 맨 앞 열이 달라집니다. */}
          {activeTab === 'done' ? (
            <>
              <th className="text-center px-1 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-14">승인상태</th>
              <th className="text-center px-1 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-14">입고현황</th>
              <th className="text-center px-1 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-14">구매현황</th>
              <th className="text-center px-1 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-14">결제 종류</th>
            </>
          ) : activeTab === 'purchase' ? (
            <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-24">구매 현황</th>
          ) : activeTab === 'receipt' ? (
            <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-24">입고 상태</th>
          ) : (
            <th className="text-center px-1 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-24">승인상태</th>
          )}
          {/* 아래는 표의 각 열(항목) 이름입니다. */}
          <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-36">발주번호 / 품명 수</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-20">구매업체</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-20">담당자</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-16">청구일</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-20">입고요청일</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-20">구매요청자</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-32">품명</th>
          <th className={`text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border ${activeTab === 'purchase' ? 'min-w-80' : 'min-w-32'}`}>규격</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-16">수량</th>
          <th className="text-right px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-24">단가(₩)</th>
          <th className="text-right px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-24">합계(₩)</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-32">비고</th>
          {showLinkColumn && (
            <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-32">링크</th>
          )}
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-16">PJ업체</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-16">수주번호</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-16">item</th>
          {activeTab !== 'purchase' && (
            <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-16">지출예정일</th>
          )}
          {(activeTab === 'done' || activeTab === 'pending') && (
            <>
              <th className="text-center px-1 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-14">수정</th>
              <th className="text-center px-1 py-2 text-xs font-medium text-muted-foreground border-b border-border min-w-14">삭제</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {/* 아래는 실제 데이터(주문서 목록)를 한 줄씩 표로 그리는 부분입니다. */}
        {displayData.map((item) => {
          // 그룹/하위항목 등 표의 구조를 위한 변수들입니다.
          const isGroupHeader = item.isGroupHeader;
          const isSubItem = item.isSubItem;
          const isLastSubItem = item.isLastSubItem;
          const isExpanded = expandedGroups.has(item.purchase_order_number || '');
          const isSingleRowGroup = isGroupHeader && (item.groupSize ?? 1) === 1;
          const isMultiRowGroupHeader = isGroupHeader && (item.groupSize ?? 1) > 1;
          // 고유 key 생성
          const keyType = isGroupHeader ? 'header' : isSubItem ? 'sub' : 'single';
          const key = `${item.purchase_order_number}-${item.line_number ?? 0}-${keyType}`;

          // 하위 항목(상세)은 해당 그룹이 펼쳐졌을 때만 화면에 보이도록 처리
          // isSubItem이 true이고, isExpanded가 false면 렌더링하지 않음
          if (isSubItem && !isExpanded) {
            return null;
          }

          // 실제 한 줄(행)을 그리는 부분입니다. 클릭, 색상, 그룹 등 다양한 조건이 있습니다.
          return (
            <tr
              key={key}
              className={`transition-colors h-12 relative border-b border-border ${
                activeTab === 'pending' && isAdvancePayment(item.progress_type)
                  ? 'bg-rose-100 !bg-rose-100 cursor-pointer'
                  : isAdvancePayment(item.progress_type)
                  ? 'bg-rose-100 hover:bg-rose-150 !bg-rose-100 cursor-pointer'
                  : isSubItem
                  ? isLastSubItem
                    ? 'bg-gray-50 hover:bg-blue-50 cursor-pointer'
                    : 'bg-gray-50 hover:bg-gray-100'
                  : isMultiRowGroupHeader
                  ? isExpanded
                    ? 'bg-blue-50 hover:bg-blue-100 cursor-pointer'
                    : 'hover:bg-blue-50 cursor-pointer'
                  : isSingleRowGroup
                  ? 'bg-white cursor-pointer'
                  : 'hover:bg-muted/10'
              }`}
              style={{
                backgroundColor: isAdvancePayment(item.progress_type) ? '#ffe4e6' : undefined,
                ...(isMultiRowGroupHeader && isExpanded && {
                  borderLeft: '4px solid #3b82f6',
                  borderRight: '4px solid #3b82f6',
                  borderTop: '4px solid #3b82f6'
                }),
                ...(isSubItem && !isLastSubItem && {
                  borderLeft: '4px solid #3b82f6',
                  borderRight: '4px solid #3b82f6'
                }),
                ...(isLastSubItem && {
                  borderLeft: '4px solid #3b82f6',
                  borderRight: '4px solid #3b82f6',
                  borderBottom: '4px solid #3b82f6'
                }),
                ...(isSingleRowGroup && expandedGroups.has(item.purchase_order_number || '') && {
                  border: '4px solid #3b82f6'
                })
              }}
              onClick={() => {
                if ((isMultiRowGroupHeader || isLastSubItem || isSingleRowGroup) && item.purchase_order_number) {
                  toggleGroup(item.purchase_order_number);
                }
              }}
            >
              {/* 실제 각 셀(열) 렌더링은 기존 코드 유지, 필요시 추가 주석 */}
              {activeTab === 'done' ? (
                <>
                  {/* 승인상태(최종) */}
                  {isGroupHeader ? (
                    <td className="px-1 py-2 text-xs text-foreground text-center min-w-14">
                      <span className={`inline-block px-2 py-1 rounded-lg font-semibold select-none`}
                        style={{
                          minWidth: 40,
                          boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)',
                          border: 'none',
                          background: item.final_manager_status === 'approved' ? '#22c55e' : '#e5e7eb',
                          color: item.final_manager_status === 'approved' ? '#fff' : '#222',
                        }}>
                        {item.final_manager_status === 'pending' ? '대기' : item.final_manager_status === 'approved' ? '승인' : item.final_manager_status}
                      </span>
                    </td>
                  ) : <td className="min-w-14" />}
                  {/* 입고현황 */}
                  {isGroupHeader ? (
                    <td className="px-1 py-2 text-xs text-foreground text-center min-w-14">
                      <span className={`inline-block px-2 py-1 rounded-lg font-semibold select-none`}
                        style={{
                          minWidth: 40,
                          boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)',
                          border: 'none',
                          background: item.is_received ? '#22c55e' : '#e5e7eb',
                          color: item.is_received ? '#fff' : '#222',
                        }}>
                        {item.is_received ? '입고' : '대기'}
                      </span>
                    </td>
                  ) : <td className="min-w-14" />}
                  {/* 구매현황: 결제종류가 '구매 요청'이 아닌 경우 공백 */}
                  {item.payment_category === '구매 요청' ? (
                    <td className="px-1 py-2 text-xs text-foreground text-center min-w-14">
                      <span
                        className={`inline-block px-2 py-1 rounded-lg font-semibold select-none`}
                        style={{
                          minWidth: 40,
                          boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)',
                          border: 'none',
                          background: item.is_payment_completed ? '#22c55e' : '#e5e7eb',
                          color: item.is_payment_completed ? '#fff' : '#222',
                        }}
                      >
                        {item.is_payment_completed ? '완료' : '대기'}
                      </span>
                    </td>
                  ) : (
                    <td className="min-w-14" />
                  )}
                  {/* 결제 종류 */}
                  {isGroupHeader ? (
                    <td className="px-1 py-2 text-xs text-foreground text-center min-w-14">
                      {item.payment_category}
                    </td>
                  ) : <td className="min-w-14" />}
                </>
              ) : activeTab === 'purchase' ? (
                isGroupHeader ? (
                  <td className="px-2 py-2 text-xs text-foreground text-center min-w-24" style={{ overflow: 'visible' }}>
                    {item.is_payment_completed ? (
                      <span
                        className="inline-block px-2 py-1 rounded-lg font-semibold bg-green-500 text-white select-none"
                        style={{ minWidth: 40, boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)', border: 'none' }}
                      >
                        완료
                      </span>
                    ) : canCompletePayment ? (
                      <button
                        className="inline-block px-2 py-1 rounded-lg font-semibold bg-gray-200 text-gray-800 transition-all duration-150 focus:outline-none select-none relative overflow-hidden"
                        style={{
                          minWidth: 40,
                          boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        onClick={async e => {
                          e.stopPropagation();
                          await handleCompletePayment(item.purchase_order_number!);
                        }}
                      >
                        대기
                      </button>
                    ) : (
                      <span
                        className="inline-block px-2 py-1 rounded-lg font-semibold bg-gray-200 text-gray-800 opacity-60 select-none"
                        style={{
                          minWidth: 40,
                          boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)',
                          border: 'none',
                          cursor: 'not-allowed',
                        }}
                      >
                        대기
                      </span>
                    )}
                  </td>
                ) : <td className="min-w-24" />
              ) : activeTab === 'receipt' ? (
                isGroupHeader ? (
                  <td className="px-2 py-2 text-xs text-foreground text-center min-w-24" style={{ overflow: 'visible' }}>
                    {item.is_received ? (
                      <span
                        className={
                          `inline-block px-2 py-1 rounded-lg font-semibold bg-green-500 text-white select-none`
                        }
                        style={{
                          minWidth: 40,
                          boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)',
                          border: 'none',
                        }}
                      >
                        입고
                      </span>
                    ) : (
                      currentUserName === item.requester_name || currentUserRoles.includes('app_admin') || currentUserRoles.includes('ceo') ? (
                        <button
                          className={`inline-block px-2 py-1 rounded-lg font-semibold bg-gray-200 text-gray-800 transition-all duration-150 focus:outline-none select-none relative overflow-hidden ${pressedOrder === item.purchase_order_number ? 'scale-90' : ''}`}
                          style={{
                            minWidth: 40,
                            boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                          onClick={async e => {
                            e.stopPropagation();
                            setPressedOrder(item.purchase_order_number || '');
                            await handleCompleteReceipt(item.purchase_order_number!);
                            setPressedOrder(null);
                          }}
                        >
                          대기
                        </button>
                      ) : (
                        <span className={`inline-block px-2 py-1 rounded-lg font-semibold bg-gray-200 text-gray-800 opacity-60 select-none`} style={{ minWidth: 40, boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)', border: 'none', cursor: 'not-allowed' }}>대기</span>
                      )
                    )}
                  </td>
                ) : <td className="min-w-24" />
              ) : (
                <td className="px-3 py-2 text-xs text-foreground font-medium text-center min-w-36">
                  {isGroupHeader && <StatusPair mid={item.middle_manager_status} final={item.final_manager_status} />}
                </td>
              )}
              {/* 이하 공통 컬럼들 */}
              <td className="px-3 py-2 text-xs text-foreground font-medium text-left min-w-36">
                <div className="flex flex-col items-start gap-1">
                  <span className="truncate flex items-center gap-1">
                    {/* 엑셀 다운로드 아이콘: 그룹 헤더(첫 행)에만 표시 */}
                    {isGroupHeader && (
                      <Image
                        src="/excels-icon.svg"
                        alt="엑셀 다운로드"
                        width={16}
                        height={16}
                        className={`inline-block align-middle transition-transform p-0.5 rounded
                          ${item.is_po_download ? 'border border-gray-400' : ''}
                          ${isAdvancePayment(item.progress_type) || item.final_manager_status === 'approved'
                            ? (item.is_po_download ? 'cursor-pointer' : 'cursor-pointer hover:scale-110')
                            : 'opacity-40 grayscale cursor-not-allowed'}`}
                        role="button"
                        tabIndex={isAdvancePayment(item.progress_type) || item.final_manager_status === 'approved' ? 0 : -1}
                        onClick={async (e) => {
                          if (isAdvancePayment(item.progress_type) || item.final_manager_status === 'approved') {
                            e.stopPropagation();
                            await generateExcelForOrder(item.purchase_order_number!);
                          }
                        }}
                        onKeyDown={async (e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && (isAdvancePayment(item.progress_type) || item.final_manager_status === 'approved')) {
                            e.preventDefault();
                            e.stopPropagation();
                            await generateExcelForOrder(item.purchase_order_number!);
                          }
                        }}
                        style={{
                          filter: item.is_po_download ? 'grayscale(1)' : (!isAdvancePayment(item.progress_type) && item.final_manager_status !== 'approved' ? 'grayscale(1) opacity(0.4)' : undefined),
                          pointerEvents: !isAdvancePayment(item.progress_type) && item.final_manager_status !== 'approved' ? 'none' : 'auto'
                        }}
                        title="엑셀 발주서 다운로드"
                      />
                    )}
                    {item.purchase_order_number}
                    {isGroupHeader && item.groupSize && item.groupSize > 1 && ` (외 ${item.groupSize - 1}개)`}
                  </span>
                </div>
              </td>
              {/* 구매업체 - 편집 가능 */}
              <td className="px-2 py-2 text-xs text-foreground text-center min-w-20">
                {isCurrentlyEditing(item) ? (
                  <ReactSelect
                    value={vendors.find(v => v.id === getEditValue(item).vendor_id) ? 
                      { value: getEditValue(item).vendor_id, label: vendors.find(v => v.id === getEditValue(item).vendor_id)?.vendor_name } : 
                      null
                    }
                    onChange={(option: any) => {
                      const vendorId = option?.value;
                      updateEditValue(item, 'vendor_id', vendorId);
                      // vendor 변경시 contacts 초기화
                      updateEditValue(item, 'vendor_contacts', []);
                    }}
                    options={vendors.map(v => ({ value: v.id, label: v.vendor_name }))}
                    placeholder="업체 선택"
                    isClearable
                    isSearchable
                    styles={{
                      control: (base) => ({ ...base, minHeight: '24px', height: '24px', fontSize: '11px' }),
                      valueContainer: (base) => ({ ...base, height: '24px', padding: '0 4px' }),
                      input: (base) => ({ ...base, margin: 0, padding: 0 }),
                      indicatorsContainer: (base) => ({ ...base, height: '24px' }),
                      menu: (base) => ({ ...base, fontSize: '11px' })
                    }}
                  />
                ) : (
                  item.vendor_name
                )}
              </td>
              {/* 담당자 - 편집 가능 */}
              <td className="px-2 py-2 text-xs text-foreground text-center truncate min-w-20">
                {isCurrentlyEditing(item) ? (
                  <ReactSelect
                    value={getEditValue(item).vendor_contacts?.length > 0 && getEditValue(item).vendor_id ?
                      vendorContacts
                        .filter(c => c.vendor_id === getEditValue(item).vendor_id && getEditValue(item).vendor_contacts?.includes(c.id.toString()))
                        .map(c => ({ value: c.id.toString(), label: c.contact_name }))[0] :
                      null
                    }
                    onChange={(option: any) => {
                      const contactId = option?.value;
                      updateEditValue(item, 'vendor_contacts', contactId ? [contactId] : []);
                    }}
                    options={vendorContacts
                      .filter(c => c.vendor_id === getEditValue(item).vendor_id)
                      .map(c => ({ value: c.id.toString(), label: c.contact_name }))
                    }
                    placeholder="담당자 선택"
                    isClearable
                    isSearchable
                    isDisabled={!getEditValue(item).vendor_id}
                    styles={{
                      control: (base) => ({ ...base, minHeight: '24px', height: '24px', fontSize: '11px' }),
                      valueContainer: (base) => ({ ...base, height: '24px', padding: '0 4px' }),
                      input: (base) => ({ ...base, margin: 0, padding: 0 }),
                      indicatorsContainer: (base) => ({ ...base, height: '24px' }),
                      menu: (base) => ({ ...base, fontSize: '11px' })
                    }}
                  />
                ) : (
                  item.contact_name || '-'
                )}
              </td>
              <td className="px-2 py-2 text-xs text-foreground text-center min-w-16 truncate">{formatDate(item.request_date)}</td>
              {/* 입고요청일 - 편집 가능 */}
              <td className="px-2 py-2 text-xs text-foreground text-center min-w-20 truncate">
                {isCurrentlyEditing(item) ? (
                  <Input
                    type="date"
                    value={getEditValue(item).delivery_request_date}
                    onChange={(e) => updateEditValue(item, 'delivery_request_date', e.target.value)}
                    className="h-6 text-xs border-0 p-1 focus:ring-1 focus:ring-blue-500 text-center"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  formatDate(item.delivery_request_date)
                )}
              </td>
              <td className="px-2 py-2 text-xs text-foreground text-center truncate min-w-20">{item.requester_name}</td>
              {/* 품명 - 편집 가능 */}
              <td className="px-2 py-2 text-xs text-foreground text-left min-w-32">
                {isCurrentlyEditing(item) ? (
                  <Input
                    value={getEditValue(item).item_name}
                    onChange={(e) => updateEditValue(item, 'item_name', e.target.value)}
                    className="h-6 text-xs border-0 p-1 focus:ring-1 focus:ring-blue-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  item.item_name
                )}
              </td>
              {/* 규격 - 편집 가능 */}
              <td className={`px-2 py-2 text-xs text-foreground relative ${activeTab === 'purchase' ? 'min-w-80' : 'min-w-32'}`}>
                {isCurrentlyEditing(item) ? (
                  <Input
                    value={getEditValue(item).specification}
                    onChange={(e) => updateEditValue(item, 'specification', e.target.value)}
                    className="h-6 text-xs border-0 p-1 focus:ring-1 focus:ring-blue-500 w-full"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  item.specification
                )}
              </td>
              {/* 수량 - 편집 가능 */}
              <td className="px-2 py-2 text-xs text-foreground text-center min-w-16 truncate">
                {isCurrentlyEditing(item) ? (
                  <Input
                    type="number"
                    value={getEditValue(item).quantity}
                    onChange={(e) => updateEditValue(item, 'quantity', parseInt(e.target.value) || 0)}
                    className="h-6 text-xs border-0 p-1 focus:ring-1 focus:ring-blue-500 text-center"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  item.quantity
                )}
              </td>
              {/* 단가 - 편집 가능 */}
              <td className="px-2 py-2 text-xs text-foreground text-right min-w-24 truncate">
                {isCurrentlyEditing(item) ? (
                  <Input
                    type="number"
                    value={getEditValue(item).unit_price_value}
                    onChange={(e) => updateEditValue(item, 'unit_price_value', parseFloat(e.target.value) || 0)}
                    className="h-6 text-xs border-0 p-1 focus:ring-1 focus:ring-blue-500 text-right"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  formatCurrency(item.unit_price_value, item.currency)
                )}
              </td>
              <td className="px-2 py-2 text-xs text-foreground text-right min-w-24 truncate">{formatCurrency(item.amount_value, item.currency)}</td>
              {/* 비고 - 편집 가능 */}
              <td className="px-2 py-2 text-xs text-foreground text-left min-w-32" title={item.remark}>
                {isCurrentlyEditing(item) ? (
                  <Input
                    value={getEditValue(item).remark}
                    onChange={(e) => updateEditValue(item, 'remark', e.target.value)}
                    className="h-6 text-xs border-0 p-1 focus:ring-1 focus:ring-blue-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  item.remark
                )}
              </td>
              {/* 링크 - 편집 가능 (구매현황/전체항목 탭에서만) */}
              {showLinkColumn && (
                <td className="px-2 py-2 text-xs text-foreground text-left min-w-32">
                  {isCurrentlyEditing(item) ? (
                    <Input
                      value={getEditValue(item).link}
                      onChange={(e) => updateEditValue(item, 'link', e.target.value)}
                      className="h-6 text-xs border-0 p-1 focus:ring-1 focus:ring-blue-500 w-full"
                      placeholder="URL 입력"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    item.link ? (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline hover:text-blue-800 break-all"
                        title={item.link}
                      >
                        {item.link.length > 30 ? `${item.link.substring(0, 30)}...` : item.link}
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )
                  )}
                </td>
              )}
              <td className="px-2 py-2 text-xs text-foreground text-center truncate min-w-16">{item.project_vendor}</td>
              <td className="px-2 py-2 text-xs text-foreground text-center truncate min-w-16">{item.sales_order_number}</td>
              <td className="px-2 py-2 text-xs text-foreground text-center truncate min-w-16">{item.project_item}</td>
              {/* 지출예정일 - 수정 불가 (vendors 테이블 정보) */}
              {activeTab !== 'purchase' && (
                <td className="px-2 py-2 text-xs text-foreground text-center truncate min-w-16">
                  {item.vendor_payment_schedule}
                </td>
              )}

              {/* 수정/삭제 – done, pending 탭에서 표시 */}
              {(activeTab === 'done' || activeTab === 'pending') && (
                <>
                  {/* 수정 버튼 */}
                  {isGroupHeader ? (
                    <td className="px-1 py-2 text-xs text-foreground text-center min-w-14">
                      {isCurrentlyEditing(item) ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              saveEditing();
                            }}
                          >
                            저장
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelEditing();
                            }}
                          >
                            취소
                          </Button>
                        </div>
                      ) : (
                        canEditItem(item) ? (
                          <button
                            className="inline-block px-2 py-1 text-xs font-medium text-white rounded-md bg-gradient-to-b from-blue-500/90 to-blue-600/90 shadow-sm hover:shadow-md focus:outline-none transition-colors duration-150"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(item);
                            }}
                          >
                            수정
                          </button>
                        ) : (
                          <span className="inline-block px-2 py-1 text-xs font-medium text-white rounded-md bg-gradient-to-b from-gray-400/80 to-gray-500/80 opacity-60 cursor-not-allowed select-none">
                            수정
                          </span>
                        )
                      )}
                    </td>
                  ) : (
                    <td className="min-w-14" />
                  )}
                  {/* 삭제 버튼 */}
                  {isGroupHeader ? (
                    <td className="px-1 py-2 text-xs text-foreground text-center min-w-14">
                      {isCurrentlyEditing(item) ? (
                        // 수정 모드일 때는 헤더도 품목삭제
                        canDelete ? (
                          <button
                            className="inline-block px-2 py-1 text-xs font-medium text-white rounded-md bg-gradient-to-b from-orange-500/90 to-orange-600/90 shadow-sm hover:shadow-md focus:outline-none transition-colors duration-150"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(item.purchase_order_number!, item.line_number!);
                            }}
                            title="이 품목만 삭제"
                          >
                            품목삭제
                          </button>
                        ) : (
                          <span className="inline-block px-2 py-1 text-xs font-medium text-white rounded-md bg-gradient-to-b from-gray-400/80 to-gray-500/80 opacity-60 cursor-not-allowed select-none">
                            품목삭제
                          </span>
                        )
                      ) : (
                        // 평상시에는 전체삭제
                        canDelete ? (
                          <button
                            className="inline-block px-2 py-1 text-xs font-medium text-white rounded-md bg-gradient-to-b from-red-500/90 to-red-600/90 shadow-sm hover:shadow-md focus:outline-none transition-colors duration-150"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteOrder(item.purchase_order_number!);
                            }}
                            title="전체 발주 삭제"
                          >
                            전체삭제
                          </button>
                        ) : (
                          <span className="inline-block px-2 py-1 text-xs font-medium text-white rounded-md bg-gradient-to-b from-gray-400/80 to-gray-500/80 opacity-60 cursor-not-allowed select-none">
                            전체삭제
                          </span>
                        )
                      )}
                    </td>
                  ) : isSubItem ? (
                    <td className="px-1 py-2 text-xs text-foreground text-center min-w-14">
                      {/* 수정 모드일 때만 품목삭제 버튼 표시 */}
                      {isCurrentlyEditing(item) ? (
                        canDelete ? (
                          <button
                            className="inline-block px-2 py-1 text-xs font-medium text-white rounded-md bg-gradient-to-b from-orange-500/90 to-orange-600/90 shadow-sm hover:shadow-md focus:outline-none transition-colors duration-150"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(item.purchase_order_number!, item.line_number!);
                            }}
                            title="이 품목만 삭제"
                          >
                            품목삭제
                          </button>
                        ) : (
                          <span className="inline-block px-2 py-1 text-xs font-medium text-white rounded-md bg-gradient-to-b from-gray-400/80 to-gray-500/80 opacity-60 cursor-not-allowed select-none">
                            품목삭제
                          </span>
                        )
                      ) : (
                        // 평상시에는 빈 공간
                        <span></span>
                      )}
                    </td>
                  ) : (
                    <td className="min-w-14" />
                  )}
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default PurchaseTable;