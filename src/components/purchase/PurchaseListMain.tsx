"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, MoreHorizontal, Mail, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import EmailButton from "@/components/purchase/EmailButton";
import EmailDrawer from "@/components/purchase/EmailDrawer";

const purchaseData = [
  { id: "PO-001", item: "사무용품", requester: "김철수", amount: "₩150,000", status: "승인완료", date: "2024-01-15" },
  { id: "PO-002", item: "IT장비", requester: "이영희", amount: "₩2,500,000", status: "승인대기", date: "2024-01-14" },
  { id: "PO-003", item: "청소용품", requester: "박민수", amount: "₩80,000", status: "승인완료", date: "2024-01-13" },
  { id: "PO-004", item: "사무용 의자", requester: "정수진", amount: "₩450,000", status: "승인대기", date: "2024-01-12" },
  { id: "PO-005", item: "프린터 토너", requester: "김철수", amount: "₩120,000", status: "승인완료", date: "2024-01-11" },
  { id: "PO-006", item: "회의실 테이블", requester: "박민수", amount: "₩800,000", status: "승인대기", date: "2024-01-10" },
  { id: "PO-007", item: "모니터", requester: "이영희", amount: "₩650,000", status: "승인완료", date: "2024-01-09" },
  { id: "PO-008", item: "키보드 & 마우스", requester: "김철수", amount: "₩95,000", status: "승인완료", date: "2024-01-08" }
];

interface PurchaseListMainProps {
  onEmailToggle?: () => void;
  showEmailButton?: boolean;
}

export default function PurchaseListMain({ onEmailToggle, showEmailButton = true }: PurchaseListMainProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  const filteredData = purchaseData.filter(item => {
    const matchesSearch = item.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.requester.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEmployee = selectedEmployee === "all" || item.requester === selectedEmployee;
    const matchesTab = activeTab === "all" || 
                      (activeTab === "pending" && item.status === "승인대기") ||
                      (activeTab === "approved" && item.status === "승인완료");
    
    return matchesSearch && matchesEmployee && matchesTab;
  });

  const stats = {
    total: purchaseData.length,
    pending: purchaseData.filter(item => item.status === "승인대기").length,
    approved: purchaseData.filter(item => item.status === "승인완료").length,
  };

  return (
    <Card className="h-full flex flex-col bg-card border-border rounded-lg card-shadow overflow-hidden w-full">
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
            <Button variant="outline" size="sm" className="gap-1.5 rounded-md h-8 px-3">
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">필터</span>
            </Button>
          </div>
        </div>
        
        {/* Professional Stats Cards - 더 넓은 공간 활용 */}
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-background px-6 py-4 rounded-lg border border-border hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground font-medium">전체 발주</span>
              <div className="w-3 h-3 rounded-sm bg-primary"></div>
            </div>
            <div className="text-2xl font-semibold text-foreground leading-none">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Total Orders</p>
          </div>
          
          <div className="bg-background px-6 py-4 rounded-lg border border-border hover:border-warning/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground font-medium">승인 대기</span>
              <div className="w-3 h-3 rounded-sm bg-warning"></div>
            </div>
            <div className="text-2xl font-semibold text-warning leading-none">{stats.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending Approval</p>
          </div>
          
          <div className="bg-background px-6 py-4 rounded-lg border border-border hover:border-success/30 transition-colors">
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
              className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm font-medium transition-all duration-200 text-sm h-8"
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
                <SelectTrigger className="w-40 h-9 text-sm bg-background border-border rounded-md">
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
                  className="pl-10 h-9 text-sm bg-background border-border rounded-md focus-ring"
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
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">품목</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">요청자</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">금액</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">상태</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">일자</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground border-b border-border">작업</th>
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
                      <td className="px-6 py-4 text-sm text-foreground font-medium">{item.id}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{item.item}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{item.requester}</td>
                      <td className="px-6 py-4 text-sm text-foreground font-medium">{item.amount}</td>
                      <td className="px-6 py-4">
                        <Badge 
                          className={`text-xs border rounded-md px-3 py-1 ${
                            item.status === "승인완료" 
                              ? "bg-success/10 text-success border-success/20 hover:bg-success/20" 
                              : "bg-warning/10 text-warning border-warning/20 hover:bg-warning/20"
                          }`}
                        >
                          {item.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{item.date}</td>
                      <td className="px-6 py-4">
                        <Button variant="ghost" size="sm" className="w-8 h-8 p-0 rounded-md hover:bg-muted">
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </td>
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
