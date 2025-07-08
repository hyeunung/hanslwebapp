"use client";
import React, { useState, useEffect, useMemo } from "react";
import ApproveDetailAccordion from "./ApproveDetailAccordion";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { usePurchaseData } from "@/hooks/usePurchaseData";

// 데이터 타입 정의
interface ItemDetail {
  lineNumber: number;
  itemName: string;
  specification: string;
  quantity: number;
  unitPriceValue: number;
  amountValue: number;
  remark?: string;
}

interface ApproveRow {
  id: string;
  requestType: string;
  paymentCategory: string;
  vendorName: string;
  contactName: string;
  requesterName: string;
  requestDate: string;
  deliveryRequestDate: string;
  projectVendor: string;
  salesOrderNumber: string;
  projectItem: string;
  purchaseOrderNumber: string;
  progressType: string;
  items: ItemDetail[];
  middleManagerStatus: "approved" | "pending" | "rejected";
  finalManagerStatus: "approved" | "pending" | "rejected";
  isPaymentCompleted: boolean;
}

function renderStatusBadge(status: "approved" | "pending" | "rejected" | string) {
  if (status === "approved" || status === "승인")
    return (
      <span
        className="text-white px-4 py-1 rounded-md text-base tracking-widest shadow"
        style={{
          background: 'linear-gradient(270deg, #6fd47e 0%, #5fcf6c 100%)',
          boxShadow: '0 2px 8px 0 rgba(60, 120, 60, 0.35)'
        }}
      >
        승  인
      </span>
    );
  if (status === "rejected" || status === "반려")
    return (
      <span
        className="text-white px-4 py-1 rounded-md text-base tracking-widest shadow"
        style={{
          background: 'linear-gradient(270deg, #ff8a8a 0%, #ff5e62 100%)',
          boxShadow: '0 2px 8px 0 rgba(180, 60, 60, 0.35)'
        }}
      >
        반  려
      </span>
    );
  return (
    <span
      className="text-gray-600 px-4 py-1 rounded-md text-base tracking-widest shadow"
      style={{
        background: 'linear-gradient(270deg, #f3f4f6 0%, #e5e7eb 100%)',
        boxShadow: '0 2px 8px 0 rgba(120, 120, 120, 0.13)'
      }}
    >
      대  기
    </span>
  );
}

// 요청유형 배지 렌더러
function renderRequestTypeBadge(type: string) {
  const baseStyle =
    "inline-block px-3 py-1 rounded-md text-[13px] font-semibold shadow";
  switch (type) {
    case "원자재": // Raw material – green (same as 승인 배지)
      return (
        <span
          className={`${baseStyle} text-white`}
          style={{
            background:
              "linear-gradient(270deg, #6fd47e 0%, #5fcf6c 100%)",
            boxShadow: "0 2px 8px 0 rgba(60, 120, 60, 0.35)",
          }}
        >
          원자재
        </span>
      );
    case "소모품": // Consumable – orange example colour
      return (
        <span
          className={`${baseStyle} text-white`}
          style={{
            background:
              "linear-gradient(270deg, #ffb76b 0%, #ff8b2b 100%)",
            boxShadow: "0 2px 8px 0 rgba(180, 120, 60, 0.35)",
          }}
        >
          소모품
        </span>
      );
    default:
      return <span className={baseStyle}>{type}</span>;
  }
}

const TAB_ORDER = ["pending", "approved", "all"];
const TAB_LABELS: Record<string, string> = {
  pending: "대기",
  approved: "완료",
  all: "전체"
};
const TAB_COLORS: Record<string, string> = {
  pending: "bg-yellow-400 text-yellow-900 hover:bg-yellow-500",
  approved: "bg-green-500 text-white hover:bg-green-600",
  all: "bg-gray-200 text-gray-800 hover:bg-gray-300"
};

const ApproveMain: React.FC = () => {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [approveList, setApproveList] = useState<ApproveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>("pending");
  const { currentUserRoles, loadMyRequests } = usePurchaseData();

  // 삭제 권한 확인 (발주 목록과 동일)
  const canDelete = currentUserRoles.includes('final_approver') || currentUserRoles.includes('app_admin') || currentUserRoles.includes('ceo');

  // 삭제 처리 함수
  const handleDeleteOrder = async (orderNumber: string) => {
    if (!canDelete) {
      alert('삭제 권한이 없습니다.');
      return;
    }

    if (!confirm(`발주번호 ${orderNumber}을(를) 삭제하시겠습니까?\n\n관련된 모든 데이터(품목 등)가 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      // 1. 먼저 purchase_request의 ID를 가져옴
      const { data: purchaseData, error: fetchErr } = await supabase
        .from('purchase_requests')
        .select('id')
        .eq('purchase_order_number', orderNumber);
      
      if (fetchErr) throw fetchErr;
      if (!purchaseData || purchaseData.length === 0) {
        alert('해당 발주번호를 찾을 수 없습니다.');
        return;
      }

      const purchaseRequestIds = purchaseData.map(item => item.id);

      // 2. lead_buyer_notifications에서 관련 알림 삭제
      for (const id of purchaseRequestIds) {
        const { error: notificationErr } = await supabase
          .from('lead_buyer_notifications')
          .delete()
          .eq('purchase_request_id', id);
        if (notificationErr) {
          console.warn('알림 삭제 중 오류:', notificationErr);
          // 알림 삭제 오류는 경고만 하고 계속 진행
        }
      }

      // 3. purchase_requests 삭제 (purchase_request_items는 CASCADE로 자동 삭제)
      const { error: reqErr } = await supabase
        .from('purchase_requests')
        .delete()
        .eq('purchase_order_number', orderNumber);
      if (reqErr) throw reqErr;

      // 로컬 상태에서도 제거
      setApproveList(prev => prev.filter(item => item.purchaseOrderNumber !== orderNumber));

      // 전역 목록 재로딩 (발주 목록 화면 포함)
      if (loadMyRequests) {
        await loadMyRequests();
      }

      alert('삭제가 완료되었습니다.');
    } catch (error) {
      console.error('삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  /* ------------------------------------------------------------------
   * 역할별 요청유형 필터링
   *  - raw_material_manager  ➜  "원자재" 요청만 표시
   *  - consumable_manager    ➜  "소모품" 요청만 표시
   *    (두 역할 모두 가진 경우엔 두 유형 모두 표시)
   * ------------------------------------------------------------------ */
  const roleFilteredList = useMemo(() => {
    // 두 역할을 모두 가진 경우엔 전체(요청유형 필터 미적용)
    const hasRawRole = currentUserRoles.includes("raw_material_manager");
    const hasConsumableRole = currentUserRoles.includes("consumable_manager");

    // 아무 역할도 없으면 그대로 반환
    if (!hasRawRole && !hasConsumableRole) return approveList;

    // raw_only 또는 consumable_only
    if (hasRawRole && !hasConsumableRole) {
      return approveList.filter((row) => row.requestType === "원자재");
    }
    if (!hasRawRole && hasConsumableRole) {
      return approveList.filter((row) => row.requestType === "소모품");
    }

    // 둘 다 있을 땐 둘 다 허용
    return approveList.filter((row) =>
      row.requestType === "원자재" || row.requestType === "소모품"
    );
  }, [approveList, currentUserRoles]);

  /* ------------------------------------------------------------------
   * 특정 직원(정현웅, 정희웅) 요청 건 비노출 – purchase_manager 제외
   * ------------------------------------------------------------------ */
  const visibleList = useMemo(() => {
    if (currentUserRoles.includes("purchase_manager") || currentUserRoles.includes("app_admin") || currentUserRoles.includes("ceo")) return roleFilteredList;
    const restricted = ["정현웅", "정희웅"];
    return roleFilteredList.filter(row => !restricted.includes(row.requesterName));
  }, [roleFilteredList, currentUserRoles]);

  useEffect(() => {
    async function fetchApproveList() {
      setLoading(true);
      try {
        // 한 번의 조인 쿼리로 모든 데이터 조회 (발주목록과 동일한 방식)
        const { data: requests, error } = await supabase
          .from("purchase_requests")
          .select(`
            *,
            vendors (
              vendor_name
            ),
            vendor_contacts (
              contact_name
            ),
            purchase_request_items (
              line_number,
              item_name,
              specification,
              quantity,
              unit_price_value,
              amount_value,
              remark
            )
          `)
          .order("request_date", { ascending: false });
          
        if (error) {
          console.error("승인관리 데이터 조회 오류", error);
          setLoading(false);
          return;
        }
        
        // 데이터 변환 (조인 결과를 ApproveRow 형태로 변환)
        const rows: ApproveRow[] = (requests || []).map((row: any) => ({
          id: row.id.toString(),
          requestType: row.request_type,
          paymentCategory: row.payment_category,
          vendorName: row.vendors?.vendor_name || "",
          contactName: row.vendor_contacts?.contact_name || "",
          requesterName: row.requester_name,
          requestDate: row.request_date,
          deliveryRequestDate: row.delivery_request_date,
          projectVendor: row.project_vendor,
          salesOrderNumber: row.sales_order_number,
          projectItem: row.project_item,
          purchaseOrderNumber: row.purchase_order_number,
          progressType: row.progress_type,
          items: (row.purchase_request_items || []).map((item: any) => ({
            lineNumber: item.line_number,
            itemName: item.item_name,
            specification: item.specification,
            quantity: item.quantity,
            unitPriceValue: item.unit_price_value,
            amountValue: item.amount_value,
            remark: item.remark,
          })).sort((a, b) => a.lineNumber - b.lineNumber),
          middleManagerStatus: row.middle_manager_status || "pending",
          finalManagerStatus: row.final_manager_status || "pending",
          isPaymentCompleted: !!row.is_payment_completed,
        }));
        
        setApproveList(rows);
      } catch (error) {
        console.error("승인관리 데이터 로딩 오류:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchApproveList();
  }, []);

  // 승인 처리 후 목록 새로고침을 위한 함수
  const refreshApproveList = async () => {
    setLoading(true);
    try {
      // 한 번의 조인 쿼리로 모든 데이터 조회 (발주목록과 동일한 방식)
      const { data: requests, error } = await supabase
        .from("purchase_requests")
        .select(`
          *,
          vendors (
            vendor_name
          ),
          vendor_contacts (
            contact_name
          ),
          purchase_request_items (
            line_number,
            item_name,
            specification,
            quantity,
            unit_price_value,
            amount_value,
            remark
          )
        `)
        .order("request_date", { ascending: false });
        
      if (error) {
        console.error("승인관리 데이터 조회 오류", error);
        setLoading(false);
        return;
      }
      
      // 데이터 변환 (조인 결과를 ApproveRow 형태로 변환)
      const rows: ApproveRow[] = (requests || []).map((row: any) => ({
        id: row.id.toString(),
        requestType: row.request_type,
        paymentCategory: row.payment_category,
        vendorName: row.vendors?.vendor_name || "",
        contactName: row.vendor_contacts?.contact_name || "",
        requesterName: row.requester_name,
        requestDate: row.request_date,
        deliveryRequestDate: row.delivery_request_date,
        projectVendor: row.project_vendor,
        salesOrderNumber: row.sales_order_number,
        projectItem: row.project_item,
        purchaseOrderNumber: row.purchase_order_number,
        progressType: row.progress_type,
        items: (row.purchase_request_items || []).map((item: any) => ({
          lineNumber: item.line_number,
          itemName: item.item_name,
          specification: item.specification,
          quantity: item.quantity,
          unitPriceValue: item.unit_price_value,
          amountValue: item.amount_value,
          remark: item.remark,
        })).sort((a, b) => a.lineNumber - b.lineNumber),
        middleManagerStatus: row.middle_manager_status || "pending",
        finalManagerStatus: row.final_manager_status || "pending",
        isPaymentCompleted: !!row.is_payment_completed,
      }));
      
      setApproveList(rows);
    } catch (error) {
      console.error("승인관리 데이터 로딩 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // 탭별 필터링 (역할 필터 통과한 리스트에 적용)
  // ------------------------------------------------------------------
  const getFilteredList = () => {
    if (activeTab === "pending") {
      return visibleList.filter(
        (r) => r.middleManagerStatus === "pending" || r.finalManagerStatus === "pending"
      );
    }
    if (activeTab === "approved") {
      return visibleList.filter(
        (r) => r.middleManagerStatus === "approved" && r.finalManagerStatus === "approved"
      );
    }
    return visibleList;
  };
  const filteredList = getFilteredList().filter(row => {
    const search = searchTerm.toLowerCase();
    // 금액(합계) 문자열 생성
    const totalAmount = row.items.reduce((sum, item) => sum + (item.amountValue || 0), 0);
    const totalAmountStr = totalAmount.toLocaleString();
    // 모든 칼럼을 문자열로 합침
    const allFields = [
      row.id,
      row.requestType,
      row.paymentCategory,
      row.vendorName,
      row.contactName,
      row.requesterName,
      row.requestDate,
      row.deliveryRequestDate,
      row.projectVendor,
      row.salesOrderNumber,
      row.projectItem,
      row.purchaseOrderNumber,
      row.progressType,
      row.middleManagerStatus,
      row.finalManagerStatus,
      row.isPaymentCompleted ? '구매완료' : '미완료',
      totalAmountStr,
      ...(row.items?.flatMap(i => [
        i.lineNumber,
        i.itemName,
        i.specification,
        i.quantity,
        i.unitPriceValue,
        i.amountValue,
        i.remark
      ]) || [])
    ];
    const searchable = allFields.map(v => (v === undefined || v === null ? '' : v.toString())).join(' ').toLowerCase();
    const matchesSearch = !search || searchable.includes(search);
    return matchesSearch;
  });

  // ------------------------------------------------------------------
  // 통계 (역할 필터 반영)
  // ------------------------------------------------------------------
  const stats = {
    pending: visibleList.filter(
      (r) => r.middleManagerStatus === "pending" || r.finalManagerStatus === "pending"
    ).length,
    approved: visibleList.filter(
      (r) => r.middleManagerStatus === "approved" && r.finalManagerStatus === "approved"
    ).length,
    all: visibleList.length,
  };

  return (
    <Card className="h-full flex flex-col bg-card border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden w-full rounded-2xl">
      <CardHeader className="pb-4 bg-muted/20 border-b border-border">
        <div className="flex items-center justify-start">
          <div className="relative flex gap-2 min-h-0 mt-0" style={{ alignItems: 'flex-start', paddingTop: 0, paddingBottom: 0 }}>
            <div style={{ position: 'absolute', left: 10, top: 5, bottom: 0, width: '4px', borderRadius: '6px', background: 'var(--success)' }} />
            <div className="flex flex-col gap-0 min-h-0 ml-6">
              <div className="font-semibold text-foreground text-[19px] mb-0">승인 관리</div>
              <div className="text-muted-foreground mt-0 text-[12.3px] mb-0" style={{ marginTop: '0px', marginBottom: '-4px' }}>Approval Management</div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-10">
            {TAB_ORDER.map(tab => (
              <Button
                key={tab}
                className={`rounded-md px-6 py-2 font-semibold text-sm shadow-sm transition-colors duration-150 ${TAB_COLORS[tab]} ${activeTab === tab ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                onClick={() => setActiveTab(tab)}
                variant="ghost"
              >
                {TAB_LABELS[tab]} <span className="ml-2 text-xs font-bold">{stats[tab as 'pending' | 'approved' | 'all']}</span>
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        {/* 네비게이션바(탭) 제거, 전체목록만 남김 */}
        <div className="px-6 py-3 border-b border-border bg-background">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="전체 항목 통합검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9 text-sm bg-background border-border rounded-md hover:shadow-sm focus:shadow-sm transition-shadow duration-200 focus-ring"
              />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto m-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="h-10">
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-28 min-w-[7rem]">중간관리자</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-28 min-w-[7rem]">최종관리자</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-32 min-w-[8.5rem]">발주번호</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-20">구매요구자</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-28 min-w-[7rem]">요청유형</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-28 min-w-[7rem]">업체명</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-20 min-w-[5.5rem]">담당자</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-48 min-w-[12rem]">품명</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-80 min-w-[20rem] text-center">규격</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-16 text-center">품목수</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-28 text-right">총 합계(₩)</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-40 min-w-[10rem] text-center">비고</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-32 min-w-[8rem] text-center">PJ업체</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-32 min-w-[8rem] text-center">수주번호</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-32 min-w-[8rem] text-center">item</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-24 min-w-[6rem]">입고요청일</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-24 min-w-[6rem]">신청일</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-16 text-center">삭제</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={18} className="text-center py-8 text-gray-400">로딩 중...</td></tr>
                ) : filteredList.length === 0 ? (
                  <tr><td colSpan={18} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr>
                ) : filteredList.map((row) => (
                  <React.Fragment key={row.id}>
                    <tr
                      className={`cursor-pointer h-10 text-xs text-foreground ${row.progressType?.includes('선진행') ? 'bg-rose-100' : 'hover:bg-blue-50'}`}
                      onClick={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}
                    >
                      <td className="text-center px-2 py-2 w-12 min-w-[3.5rem]">{renderStatusBadge(row.middleManagerStatus)}</td>
                      <td className="text-center px-2 py-2 w-12 min-w-[3.5rem]">{renderStatusBadge(row.finalManagerStatus)}</td>
                      <td className="text-center px-2 py-2 w-32 min-w-[8.5rem]">{row.purchaseOrderNumber}</td>
                      <td className="text-center px-2 py-2 w-20">{row.requesterName || '-'}</td>
                      <td className="text-center px-2 py-2 w-28 min-w-[7rem]">{renderRequestTypeBadge(row.requestType)}</td>
                      <td className="text-center px-2 py-2 w-28 min-w-[7rem]">{row.vendorName}</td>
                      <td className="text-center px-2 py-2 w-20 min-w-[5.5rem]">{row.contactName}</td>
                      <td className="text-center px-2 py-2 w-48 min-w-[12rem]">{row.items[0]?.itemName}</td>
                      <td className="text-left px-2 py-2 w-80 min-w-[20rem]">{row.items[0]?.specification}</td>
                      <td className="text-center px-2 py-2 w-16">{row.items.length > 1 ? `외 ${row.items.length - 1}개` : '-'}</td>
                      <td className="text-right px-2 py-2 w-28"><span className="text-xs text-foreground">{row.items.reduce((sum, item) => sum + (item.amountValue || 0), 0).toLocaleString()}&nbsp;₩</span></td>
                      <td className="text-left px-2 py-2 w-40 min-w-[10rem]">{row.items[0]?.remark || '-'}</td>
                      <td className="text-center px-2 py-2 w-32 min-w-[8rem]">{row.projectVendor || '-'}</td>
                      <td className="text-center px-2 py-2 w-32 min-w-[8rem]">{row.salesOrderNumber || '-'}</td>
                      <td className="text-center px-2 py-2 w-32 min-w-[8rem]">{row.projectItem || '-'}</td>
                      <td className="text-center px-2 py-2 w-24 min-w-[6rem]">{row.deliveryRequestDate}</td>
                      <td className="text-center px-2 py-2 w-24 min-w-[6rem]">{row.requestDate}</td>
                      <td className="text-center px-2 py-2 w-16">
                        {canDelete ? (
                          <button
                            className="inline-block px-2 py-1 text-xs font-medium text-white rounded-md bg-gradient-to-b from-red-500/90 to-red-600/90 shadow-sm hover:shadow-md focus:outline-none transition-colors duration-150"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteOrder(row.purchaseOrderNumber!);
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
                    </tr>
                    {expandedRowId === row.id && (
                      <tr>
                        <td colSpan={18} className="p-0 bg-transparent">
                          <div className="flex justify-center w-full mt-0 mb-8">
                            <ApproveDetailAccordion
                              id={row.id}
                              requestType={row.requestType}
                              paymentCategory={row.paymentCategory}
                              vendorName={row.vendorName}
                              contactName={row.contactName}
                              requesterName={row.requesterName}
                              requestDate={row.requestDate}
                              deliveryRequestDate={row.deliveryRequestDate}
                              projectVendor={row.projectVendor}
                              salesOrderNumber={row.salesOrderNumber}
                              projectItem={row.projectItem}
                              purchaseOrderNumber={row.purchaseOrderNumber}
                              items={row.items}
                              middleManagerStatus={row.middleManagerStatus}
                              finalManagerStatus={row.finalManagerStatus}
                              isPaymentCompleted={row.isPaymentCompleted}
                              isPurchaseTab={false}
                              onMiddleManagerStatusChange={(newStatus) => {
                                setApproveList(prev => prev.map(r => r.id === row.id ? { ...r, middleManagerStatus: newStatus as 'approved' | 'pending' | 'rejected' } : r));
                              }}
                              onFinalManagerStatusChange={(newStatus) => {
                                setApproveList(prev => prev.map(r => r.id === row.id ? { ...r, finalManagerStatus: newStatus as 'approved' | 'pending' | 'rejected' } : r));
                              }}
                              onPaymentCompletedChange={(completed) => {
                                setApproveList(prev => prev.map(r => r.id === row.id ? { ...r, isPaymentCompleted: completed } : r));
                              }}
                              roles={currentUserRoles}
                              onApproveListRefresh={refreshApproveList}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ApproveMain;
