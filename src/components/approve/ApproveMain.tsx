import React, { useState, useEffect } from "react";
import ApproveDetailAccordion from "./ApproveDetailAccordion";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

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
  items: ItemDetail[];
  middleManagerStatus: "approved" | "pending" | "rejected";
  finalManagerStatus: "approved" | "pending" | "rejected";
}

function renderStatusBadge(status: "approved" | "pending" | "rejected") {
  if (status === "approved") return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">✔ 승인</span>;
  if (status === "rejected") return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">반려</span>;
  return <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">대기</span>;
}

const ApproveMain: React.FC = () => {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [approveList, setApproveList] = useState<ApproveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

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
          vendor_id,
          contact_id,
          middle_manager_status,
          final_manager_status,
          requester_name
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
          };
        })
      );
      setApproveList(rows);
      setLoading(false);
    }
    fetchApproveList();
  }, []);

  // 필터링/탭/검색
  const filteredList = approveList.filter(row => {
    const search = searchTerm.toLowerCase();
    const searchable = [
      row.requestType,
      row.vendorName,
      row.contactName,
      row.salesOrderNumber,
      row.projectVendor,
      row.projectItem,
      ...(row.items?.map(i => i.itemName + i.specification) || [])
    ].join(" ").toLowerCase();
    const matchesSearch = !search || searchable.includes(search);
    const matchesTab = activeTab === "all" ||
      (activeTab === "pending" && (row.middleManagerStatus === "pending" || row.finalManagerStatus === "pending")) ||
      (activeTab === "approved" && row.middleManagerStatus === "approved" && row.finalManagerStatus === "approved");
    return matchesSearch && matchesTab;
  });

  // 통계
  const stats = {
    total: approveList.length,
    pending: approveList.filter(r => r.middleManagerStatus === "pending" || r.finalManagerStatus === "pending").length,
    approved: approveList.filter(r => r.middleManagerStatus === "approved" && r.finalManagerStatus === "approved").length,
  };

  return (
    <Card className="h-full flex flex-col bg-card border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden w-full">
      <CardHeader className="pb-4 bg-muted/20 border-b border-border">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <h2 className="font-semibold text-foreground">승인 관리</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Approval Management</p>
          </div>
          <div className="flex items-center gap-6 ml-6">
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span className="text-sm text-muted-foreground">전체</span>
              </div>
              <span className="text-sm font-semibold text-foreground">{stats.total}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-warning"></div>
                <span className="text-sm text-muted-foreground">대기</span>
              </div>
              <span className="text-sm font-semibold text-warning">{stats.pending}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success"></div>
                <span className="text-sm text-muted-foreground">완료</span>
              </div>
              <span className="text-sm font-semibold text-success">{stats.approved}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3 rounded-lg bg-muted/30 border-b border-border h-12 mx-6 mt-2 mb-2 p-1">
            <TabsTrigger value="all" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow font-medium transition-all duration-200 text-sm h-8 hover:shadow-sm">전체목록</TabsTrigger>
            <TabsTrigger value="pending" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm font-medium transition-all duration-200 text-sm h-8">승인대기</TabsTrigger>
            <TabsTrigger value="approved" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm font-medium transition-all duration-200 text-sm h-8">승인완료</TabsTrigger>
          </TabsList>
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
          <TabsContent value={activeTab} className="flex-1 overflow-auto m-0">
            <div className="overflow-x-auto">
              <div className="px-6 py-2 text-xs text-muted-foreground bg-muted/5 border-b border-border">
                <span className="font-medium">2024</span>
              </div>
              <table className="w-full min-w-max">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="h-10">
                    <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-16 min-w-[4rem]">요청유형</th>
                    <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-24 min-w-[6rem]">품명</th>
                    <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-20 min-w-[5rem] text-left">규격</th>
                    <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-32 min-w-[8.5rem]">발주번호</th>
                    <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-20">구매요구자</th>
                    <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-28 text-right">총 합계(₩)</th>
                    <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border w-16 text-center">품목수</th>
                    <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border">중간관리자</th>
                    <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border">최종관리자</th>
                    <th className="px-2 py-2 text-sm font-medium text-muted-foreground border-b border-border">신청일</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="text-center py-8 text-gray-400">로딩 중...</td></tr>
                  ) : filteredList.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr>
                  ) : filteredList.map((row) => (
                    <React.Fragment key={row.id}>
                      <tr
                        className="cursor-pointer hover:bg-blue-50 h-10 text-xs text-foreground"
                        onClick={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}
                      >
                        <td className="text-center px-2 py-2 w-16 min-w-[4rem]">{row.requestType}</td>
                        <td className="text-center px-2 py-2 w-24 min-w-[6rem]">{row.items[0]?.itemName}</td>
                        <td className="text-left px-2 py-2 w-20 min-w-[5rem]">{row.items[0]?.specification}</td>
                        <td className="text-center px-2 py-2 w-32 min-w-[8.5rem]">{row.salesOrderNumber}</td>
                        <td className="text-center px-2 py-2 w-20">{row.requesterName || '-'}</td>
                        <td className="text-right px-2 py-2 w-28"><span className="text-xs text-foreground">₩{row.items.reduce((sum, item) => sum + (item.amountValue || 0), 0).toLocaleString()}</span></td>
                        <td className="text-center px-2 py-2 w-16">{row.items.length > 1 ? `외 ${row.items.length - 1}개` : '-'}</td>
                        <td className="text-center px-2 py-2">{renderStatusBadge(row.middleManagerStatus)}</td>
                        <td className="text-center px-2 py-2">{renderStatusBadge(row.finalManagerStatus)}</td>
                        <td className="text-center px-2 py-2">{row.requestDate}</td>
                      </tr>
                      {expandedRowId === row.id && (
                        <tr>
                          <td colSpan={10} className="p-0">
                            <div className="flex justify-center">
                              <ApproveDetailAccordion
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
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ApproveMain;
