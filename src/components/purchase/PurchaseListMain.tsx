"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Filter, MoreHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import EmailButton from "@/components/purchase/EmailButton";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/providers/AuthProvider";

interface Purchase {
  id: number;
  purchase_order_number?: string;
  request_date: string;
  delivery_request_date: string;
  vendor_name: string;
  vendor_payment_schedule: string;
  requester_name: string;
  item_name: string;
  specification: string;
  quantity: number;
  unit_price_value: number;
  amount_value: number;
  remark: string;
  pj_vendor: string;
  order_number: string;
  item: string;
  // 기타 기존 필드 생략
}

interface PurchaseListMainProps {
  onEmailToggle?: () => void;
  showEmailButton?: boolean;
}

export default function PurchaseListMain({ onEmailToggle, showEmailButton = true }: PurchaseListMainProps) {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (user?.id) loadMyRequests();
    // eslint-disable-next-line
  }, [user?.id]);

  async function loadMyRequests() {
    if (!user) return;
    const { data } = await supabase
      .from('purchase_view')
      .select(`
        purchase_request_id,
        purchase_order_number,
        request_date,
        delivery_request_date,
        vendor_name,
        vendor_payment_schedule,
        requester_name,
        item_name,
        specification,
        quantity,
        unit_price_value,
        amount_value,
        remark
      `)
      .eq('requester_id', user.id);
    if (data) {
      setPurchases(
        (data as Array<Record<string, unknown>>).map((row) => {
          return {
            id: row.purchase_request_id as number,
            purchase_order_number: row.purchase_order_number as string,
            request_date: row.request_date as string,
            delivery_request_date: row.delivery_request_date as string,
            vendor_name: row.vendor_name as string,
            vendor_payment_schedule: row.vendor_payment_schedule as string,
            requester_name: row.requester_name as string,
            item_name: row.item_name as string,
            specification: row.specification as string,
            quantity: row.quantity as number,
            unit_price_value: row.unit_price_value as number,
            amount_value: row.amount_value as number,
            remark: row.remark as string,
            pj_vendor: '', // PJ업체(추후 데이터 연동)
            order_number: '', // 수주번호(추후 데이터 연동)
            item: row.item_name as string,
          } as Purchase;
        })
      );
    }
  }

  const filteredData = purchases.filter(item => {
    const matchesSearch = item.purchase_order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.item_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEmployee = selectedEmployee === "all" || item.requester_name === selectedEmployee;
    const matchesTab = activeTab === "all" || 
                      (activeTab === "pending" && item.delivery_request_date === "승인대기") ||
                      (activeTab === "approved" && item.delivery_request_date === "승인완료");
    
    return matchesSearch && matchesEmployee && matchesTab;
  });

  const stats = {
    total: purchases.length,
    pending: purchases.filter(item => item.delivery_request_date === "승인대기").length,
    approved: purchases.filter(item => item.delivery_request_date === "승인완료").length,
  };

  return (
    <Card className="h-full flex flex-col bg-card border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden w-full">
      {/* Professional Header - 더 넓은 패딩 */}
      <CardHeader className="pb-4 bg-muted/20 border-b border-border">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <h2 className="font-semibold text-foreground">발주 현황</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Purchase Order Management</p>
            </div>
            {showEmailButton && (
              <EmailButton 
                onClick={() => {
                  console.log('EmailButton clicked! onEmailToggle:', !!onEmailToggle);
                  if (onEmailToggle) onEmailToggle();
                }}
                inline={true}
                style={{ marginLeft: '8px' }}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 rounded-md h-8 px-3 hover:shadow-sm transition-shadow duration-200">
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">필터</span>
            </Button>
          </div>
        </div>
        
        {/* Professional Stats Cards - 더 넓은 공간 활용 */}
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-background px-6 py-4 rounded-lg border border-border hover:border-primary/30 shadow hover:shadow-sm transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground font-medium">전체 발주</span>
              <div className="w-3 h-3 rounded-sm bg-primary"></div>
            </div>
            <div className="text-2xl font-semibold text-foreground leading-none">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Total Orders</p>
          </div>
          
          <div className="bg-background px-6 py-4 rounded-lg border border-border hover:border-warning/30 shadow hover:shadow-sm transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground font-medium">승인 대기</span>
              <div className="w-3 h-3 rounded-sm bg-warning"></div>
            </div>
            <div className="text-2xl font-semibold text-warning leading-none">{stats.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending Approval</p>
          </div>
          
          <div className="bg-background px-6 py-4 rounded-lg border border-border hover:border-success/30 shadow hover:shadow-sm transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground font-medium">승인 완료</span>
              <div className="w-3 h-3 rounded-sm bg-success"></div>
            </div>
            <div className="text-2xl font-semibold text-success leading-none">{stats.approved}</div>
            <p className="text-xs text-muted-foreground mt-1">Approved</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        {/* Professional Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3 rounded-lg bg-muted/30 border-b border-border h-12 mx-6 mt-4 mb-0 p-1">
            <TabsTrigger 
              value="all" 
              className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow font-medium transition-all duration-200 text-sm h-8 hover:shadow-sm"
            >
              전체목록
            </TabsTrigger>
            <TabsTrigger 
              value="pending" 
              className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm font-medium transition-all duration-200 text-sm h-8"
            >
              승인대기
            </TabsTrigger>
            <TabsTrigger 
              value="approved" 
              className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm font-medium transition-all duration-200 text-sm h-8"
            >
              승인완료
            </TabsTrigger>
          </TabsList>

          {/* Professional Filters - 더 넓은 패딩 */}
          <div className="px-6 py-4 border-b border-border bg-background">
            <div className="flex gap-4 items-center">
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-40 h-9 text-sm bg-background border-border rounded-md hover:shadow-sm transition-shadow duration-200">
                  <SelectValue placeholder="직원선택" />
                </SelectTrigger>
                <SelectContent className="rounded-md">
                  <SelectItem value="all">전체 직원</SelectItem>
                  <SelectItem value="김철수">김철수</SelectItem>
                  <SelectItem value="이영희">이영희</SelectItem>
                  <SelectItem value="박민수">박민수</SelectItem>
                  <SelectItem value="정수진">정수진</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="발주번호, 품목명, 요청자로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-9 text-sm bg-background border-border rounded-md hover:shadow-sm focus:shadow-sm transition-shadow duration-200 focus-ring"
                />
              </div>
            </div>
          </div>

          {/* Professional Table - 더 넓은 테이블 */}
          <TabsContent value={activeTab} className="flex-1 overflow-auto m-0">
            <div className="overflow-auto">
              <table className="w-full">
                <thead className="bg-muted/10 sticky top-0">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">발주번호</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">구매업체</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">청구일</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">입고요청일</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">구매요구자</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">품명</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">규격</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">수량</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">단가</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">합계</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">비고</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">PJ업체</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">수주번호</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">item</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">지출예정일</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item, index) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03, type: "spring", damping: 20 }}
                      className="border-b border-border hover:bg-muted/10 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-foreground font-medium">{item.purchase_order_number}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{item.vendor_name}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{item.request_date}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{item.delivery_request_date}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{item.requester_name}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{item.item_name}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{item.specification}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{item.quantity}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{item.unit_price_value}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{item.amount_value}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{item.remark}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{item.pj_vendor}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{item.order_number}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{item.item}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{item.vendor_payment_schedule}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              
              {filteredData.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
