// PurchaseTable.tsx
// 이 컴포넌트는 발주(구매) 목록 테이블을 렌더링합니다.
// 비전공자도 이해할 수 있도록 한글로 상세 주석을 추가했습니다.
// props로 받은 데이터(displayData 등)를 표 형태로 보여주며,
// 행 클릭, 엑셀 다운로드 등 주요 상호작용도 이 컴포넌트에서 처리합니다.

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";

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
  // 그룹/하위 항목 표시용
  isGroupHeader?: boolean;
  groupSize?: number;
  isSubItem?: boolean;
  isLastSubItem?: boolean;
  purchase_request_file_url?: string;
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
}

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
}) => {
  // '구매현황' 탭일 때만 링크 열 표시
  const showLinkColumn = activeTab === 'purchase';

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

  const canCompletePayment = currentUserRoles.includes('app_admin') || currentUserRoles.includes('purchase_manager');
  const canDelete = currentUserRoles.includes('final_approved') || currentUserRoles.includes('app_admin');

  // 아래가 실제로 표(테이블)를 그리는 부분입니다.
  // 1. thead: 표의 맨 위(제목줄)
  // 2. tbody: 실제 데이터 행들
  // 각 행/열, 색상, 클릭 동작 등도 쉽게 설명하는 주석이 달려 있습니다.
  return (
    <table className="w-full min-w-max table-fixed">
      <thead className="bg-muted/10 sticky top-0 border-t border-border">
        <tr className="h-12">
          {/* 탭(진행상태)에 따라 표의 맨 앞 열이 달라집니다. */}
          {activeTab === 'done' ? (
            <>
              <th className="text-center px-1 py-2 text-xs font-medium text-muted-foreground border-b border-border w-14">승인상태</th>
              <th className="text-center px-1 py-2 text-xs font-medium text-muted-foreground border-b border-border w-14">입고현황</th>
              <th className="text-center px-1 py-2 text-xs font-medium text-muted-foreground border-b border-border w-14">구매현황</th>
              <th className="text-center px-1 py-2 text-xs font-medium text-muted-foreground border-b border-border w-14">결제 종류</th>
            </>
          ) : activeTab === 'purchase' ? (
            <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-24">구매 현황</th>
          ) : activeTab === 'receipt' ? (
            <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-24">입고 상태</th>
          ) : (
            <th className="text-center px-1 py-2 text-xs font-medium text-muted-foreground border-b border-border w-24">승인상태</th>
          )}
          {/* 아래는 표의 각 열(항목) 이름입니다. */}
          <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border w-36">발주번호 / 품명 수</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-20">구매업체</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-20">담당자</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-16">청구일</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-20">입고요청일</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-20">구매요청자</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-32">품명</th>
          <th className={`text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border ${activeTab === 'purchase' ? 'w-80' : 'w-32'}`}>규격</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-16">수량</th>
          <th className="text-right px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-24">단가(₩)</th>
          <th className="text-right px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-24">합계(₩)</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-32">비고</th>
          {showLinkColumn && (
            <th className={`text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border ${activeTab === 'purchase' ? 'w-12' : 'w-7'}`}>링크</th>
          )}
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-16">PJ업체</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-16">수주번호</th>
          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-16">item</th>
          {activeTab !== 'purchase' && (
            <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-16">지출예정일</th>
          )}
          {activeTab === 'done' && (
            <th className="text-center px-1 py-2 text-xs font-medium text-muted-foreground border-b border-border w-14">삭제</th>
          )}
        </tr>
      </thead>
      <tbody>
        {/* 아래는 실제 데이터(주문서 목록)를 한 줄씩 표로 그리는 부분입니다. */}
        {displayData.map((item, index) => {
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
                    <td className="px-1 py-2 text-xs text-foreground text-center w-14">
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
                  ) : <td className="w-14" />}
                  {/* 입고현황 */}
                  {isGroupHeader ? (
                    <td className="px-1 py-2 text-xs text-foreground text-center w-14">
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
                  ) : <td className="w-14" />}
                  {/* 구매현황 */}
                  {isGroupHeader ? (
                    <td className="px-1 py-2 text-xs text-foreground text-center w-14">
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
                  ) : <td className="w-14" />}
                  {/* 결제 종류 */}
                  {isGroupHeader ? (
                    <td className="px-1 py-2 text-xs text-foreground text-center w-14">
                      {item.payment_category}
                    </td>
                  ) : <td className="w-14" />}
                </>
              ) : activeTab === 'purchase' ? (
                isGroupHeader ? (
                  <td className="px-2 py-2 text-xs text-foreground text-center w-24" style={{ overflow: 'visible' }}>
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
                ) : <td className="w-24" />
              ) : activeTab === 'receipt' ? (
                isGroupHeader ? (
                  <td className="px-2 py-2 text-xs text-foreground text-center w-24" style={{ overflow: 'visible' }}>
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
                      currentUserName === item.requester_name || currentUserRoles.includes('app_admin') ? (
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
                ) : <td className="w-24" />
              ) : (
                <td className="px-3 py-2 text-xs text-foreground font-medium text-left w-36">
                  {isGroupHeader ? (
                    <>
                      <span
                        className={`inline-block px-2 py-1 rounded-lg font-semibold ${item.middle_manager_status === 'approved' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-800'}`}
                        style={{
                          minWidth: 40,
                          marginRight: 4,
                          boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)',
                          border: 'none',
                          background: item.middle_manager_status === 'approved' ? undefined : undefined,
                          color: item.middle_manager_status === 'approved' ? undefined : undefined,
                        }}
                      >
                        {item.middle_manager_status === 'pending' ? '대기' : item.middle_manager_status === 'approved' ? '승인' : item.middle_manager_status}
                      </span>
                      /
                      <span
                        className={`inline-block px-2 py-1 rounded-lg font-semibold ${item.final_manager_status === 'approved' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-800'}`}
                        style={{
                          minWidth: 40,
                          marginLeft: 4,
                          boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)',
                          border: 'none',
                          background: item.final_manager_status === 'approved' ? undefined : undefined,
                          color: item.final_manager_status === 'approved' ? undefined : undefined,
                        }}
                      >
                        {item.final_manager_status === 'pending' ? '대기' : item.final_manager_status === 'approved' ? '승인' : item.final_manager_status}
                      </span>
                    </>
                  ) : ''}
                </td>
              )}
              {/* 이하 공통 컬럼들 */}
              <td className="px-3 py-2 text-xs text-foreground font-medium text-left w-36">
                <div className="flex flex-col items-start gap-1">
                  <span className="truncate flex items-center gap-1">
                    {/* 엑셀 다운로드 아이콘: 그룹 헤더(첫 행)에만 표시 */}
                    {isGroupHeader && (
                      <Image
                        src="/excels-icon.svg"
                        alt="엑셀 다운로드"
                        width={16}
                        height={16}
                        className={`inline-block align-middle transition-transform
                          ${isAdvancePayment(item.progress_type) || item.final_manager_status === 'approved' ? 'cursor-pointer hover:scale-110' : 'opacity-40 grayscale cursor-not-allowed'}`}
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
                          filter: !isAdvancePayment(item.progress_type) && item.final_manager_status !== 'approved' ? 'grayscale(1) opacity(0.4)' : undefined,
                          pointerEvents: !isAdvancePayment(item.progress_type) && item.final_manager_status !== 'approved' ? 'none' : 'auto'
                        }}
                        title="엑셀 발주서 다운로드"
                      />
                    )}
                    {item.purchase_order_number}
                    {isGroupHeader && item.groupSize && item.groupSize > 1 && ` (${item.groupSize}건)`}
                  </span>
                </div>
              </td>
              <td className="px-2 py-2 text-xs text-foreground text-center truncate w-20">{item.vendor_name}</td>
              <td className="px-2 py-2 text-xs text-foreground text-center truncate w-20">{item.contact_name || '-'}</td>
              <td className="px-2 py-2 text-xs text-foreground text-center w-16 truncate">{formatDate(item.request_date)}</td>
              <td className="px-2 py-2 text-xs text-foreground text-center w-20 truncate">{formatDate(item.delivery_request_date)}</td>
              <td className="px-2 py-2 text-xs text-foreground text-center truncate w-20">{item.requester_name}</td>
              <td className="px-2 py-2 text-xs text-foreground text-left truncate w-32">{item.item_name}</td>
              <td className={`px-2 py-2 text-xs text-foreground truncate relative ${activeTab === 'purchase' ? 'w-80' : 'w-32'}`}>{item.specification}</td>
              <td className="px-2 py-2 text-xs text-foreground text-center w-16 truncate">{item.quantity}</td>
              <td className="px-2 py-2 text-xs text-foreground text-right w-24 truncate">{formatCurrency(item.unit_price_value, item.currency)}</td>
              <td className="px-2 py-2 text-xs text-foreground text-right w-24 truncate">{formatCurrency(item.amount_value, item.currency)}</td>
              <td className="px-2 py-2 text-xs text-foreground text-left truncate w-32" title={item.remark}>{item.remark}</td>
              {showLinkColumn && (
                <td className={`px-2 py-2 text-xs text-foreground text-left truncate overflow-hidden whitespace-nowrap ${activeTab === 'purchase' ? 'w-12' : 'w-7'}`}>
                  {isGroupHeader ? (
                    item.purchase_request_file_url ? (
                      <a
                        href={item.purchase_request_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline hover:text-blue-800"
                      >
                        {item.purchase_request_file_url}
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )
                  ) : null}
                </td>
              )}
              <td className="px-2 py-2 text-xs text-foreground text-center truncate w-16">{item.project_vendor}</td>
              <td className="px-2 py-2 text-xs text-foreground text-center truncate w-16">{item.sales_order_number}</td>
              <td className="px-2 py-2 text-xs text-foreground text-center truncate w-16">{item.project_item}</td>
              {activeTab !== 'purchase' && (
                <td className="px-2 py-2 text-xs text-foreground text-center truncate w-16">{item.vendor_payment_schedule}</td>
              )}

              {/* 삭제 – done 탭에서만 표시 */}
              {activeTab === 'done' && (
                isGroupHeader ? (
                  <td className="px-1 py-2 text-xs text-foreground text-center w-14">
                    {canDelete ? (
                      <button
                        className="inline-block px-2 py-1 text-xs font-medium text-white rounded-md bg-gradient-to-b from-red-500/90 to-red-600/90 shadow-sm hover:shadow-md focus:outline-none transition-colors duration-150"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteOrder(item.purchase_order_number!);
                        }}
                      >
                        삭제
                      </button>
                    ) : (
                      <span className="inline-block px-2 py-1 text-xs font-medium text-white rounded-md bg-gradient-to-b from-gray-400/80 to-gray-500/80 opacity-60 cursor-not-allowed select-none">
                        삭제
                      </span>
                    )}
                  </td>
                ) : <td className="w-14" />
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default PurchaseTable;