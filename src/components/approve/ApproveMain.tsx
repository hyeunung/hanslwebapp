"use client";
import React, { useState, useEffect } from "react";
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
  const { currentUserRoles } = usePurchaseData();

  /* ------------------------------------------------------------------
   * 역할별 요청유형 필터링
   *  - raw_material_manager  ➜  "원자재" 요청만 표시
   *  - consumable_manager    ➜  "소모품" 요청만 표시
   *    (두 역할 모두 가진 경우엔 두 유형 모두 표시)
   * ------------------------------------------------------------------ */
  const roleFilteredList = React.useMemo(() => {
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

  useEffect(() => {
    async function fetchApproveList() {
      setLoading(true);
      const { data: requests, error } = await supabase
        .from("purchase_requests")
        .select(`
          id,
          request_type,
          payment_category,
          request_date,
          delivery_request_date,
          project_vendor,
          sales_order_number,
          project_item,
          purchase_order_number,
          progress_type,
          vendor_id,
          contact_id,
          middle_manager_status,
          final_manager_status,
          requester_name,
          is_payment_completed
        `)
        .order("request_date", { ascending: false });
      if (error) {
        console.error("승인관리 데이터 조회 오류", error);
        setLoading(false);
        return;
      }
      const rows: ApproveRow[] = await Promise.all(
        (requests || []).map(async (row: any) => {
          // 업체명
          let vendorName = "";
          if (row.vendor_id) {
            const { data: vendor } = await supabase
              .from("vendors")
              .select("vendor_name")
              .eq("id", row.vendor_id)
              .single();
            vendorName = vendor?.vendor_name || "";
          }
          // 담당자
          let contactName = "";
          if (row.contact_id) {
            const { data: contact } = await supabase
              .from("vendor_contacts")
              .select("contact_name")
              .eq("id", row.contact_id)
              .single();
            contactName = contact?.contact_name || "";
          }
          // 품목 리스트
          const { data: items } = await supabase
            .from("purchase_request_items")
            .select("line_number, item_name, specification, quantity, unit_price_value, amount_value, remark")
            .eq("purchase_request_id", row.id);
          return {
            id: row.id.toString(),
            requestType: row.request_type,
            paymentCategory: row.payment_category,
            vendorName,
            contactName,
            requesterName: row.requester_name,
            requestDate: row.request_date,
            deliveryRequestDate: row.delivery_request_date,
            projectVendor: row.project_vendor,
            salesOrderNumber: row.sales_order_number,
            projectItem: row.project_item,
            purchaseOrderNumber: row.purchase_order_number,
            progressType: row.progress_type,
            items: (items || []).map((item: any) => ({
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
          };
        })
      );
      setApproveList(rows);
      setLoading(false);
    }
    fetchApproveList();
  }, []);

  // ------------------------------------------------------------------
  // 탭별 필터링 (역할 필터 통과한 리스트에 적용)
  // ------------------------------------------------------------------
  const getFilteredList = () => {
    if (activeTab === "pending") {
      return roleFilteredList.filter(
        (r) => r.middleManagerStatus === "pending" || r.finalManagerStatus === "pending"
      );
    }
    if (activeTab === "approved") {
      return roleFilteredList.filter(
        (r) => r.middleManagerStatus === "approved" && r.finalManagerStatus === "approved"
      );
    }
    return roleFilteredList;
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
    pending: roleFilteredList.filter(
      (r) => r.middleManagerStatus === "pending" || r.finalManagerStatus === "pending"
    ).length,
    approved: roleFilteredList.filter(
      (r) => r.middleManagerStatus === "approved" && r.finalManagerStatus === "approved"
    ).length,
    all: roleFilteredList.length,
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
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-20">구매요구자</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-28 min-w-[7rem]">요청유형</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-28 min-w-[7rem]">업체명</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-20 min-w-[5.5rem]">담당자</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-48 min-w-[12rem]">품명</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-20 min-w-[5rem] text-center">규격</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-16 text-center">품목수</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-28 text-right">총 합계(₩)</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-72 text-center">비고</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-32 min-w-[8.5rem]">발주번호</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border">입고요청일</th>
                  <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border">신청일</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={14} className="text-center py-8 text-gray-400">로딩 중...</td></tr>
                ) : filteredList.length === 0 ? (
                  <tr><td colSpan={14} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr>
                ) : filteredList.map((row) => (
                  <React.Fragment key={row.id}>
                    <tr
                      className={`cursor-pointer h-10 text-xs text-foreground ${row.progressType?.includes('선진행') ? 'bg-rose-100' : 'hover:bg-blue-50'}`}
                      onClick={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}
                    >
                      <td className="text-center px-2 py-2 w-12 min-w-[3.5rem]">{renderStatusBadge(row.middleManagerStatus)}</td>
                      <td className="text-center px-2 py-2 w-12 min-w-[3.5rem]">{renderStatusBadge(row.finalManagerStatus)}</td>
                      <td className="text-center px-2 py-2 w-20">{row.requesterName || '-'}</td>
                      <td className="text-center px-2 py-2 w-28 min-w-[7rem]">{renderRequestTypeBadge(row.requestType)}</td>
                      <td className="text-center px-2 py-2 w-28 min-w-[7rem]">{row.vendorName}</td>
                      <td className="text-center px-2 py-2 w-20 min-w-[5.5rem]">{row.contactName}</td>
                      <td className="text-center px-2 py-2 w-48 min-w-[12rem]">{row.items[0]?.itemName}</td>
                      <td className="text-left px-2 py-2 w-20 min-w-[5rem]">{row.items[0]?.specification}</td>
                      <td className="text-center px-2 py-2 w-16">{row.items.length > 1 ? `외 ${row.items.length - 1}개` : '-'}</td>
                      <td className="text-right px-2 py-2 w-28"><span className="text-xs text-foreground">{row.items.reduce((sum, item) => sum + (item.amountValue || 0), 0).toLocaleString()}&nbsp;₩</span></td>
                      <td className="text-center px-2 py-2 w-72">{row.items[0]?.remark || '-'}</td>
                      <td className="text-center px-2 py-2 w-32 min-w-[8.5rem]">{row.purchaseOrderNumber}</td>
                      <td className="text-center px-2 py-2">{row.deliveryRequestDate}</td>
                      <td className="text-center px-2 py-2">{row.requestDate}</td>
                    </tr>
                    {expandedRowId === row.id && (
                      <tr>
                        <td colSpan={14} className="p-0 bg-transparent">
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
