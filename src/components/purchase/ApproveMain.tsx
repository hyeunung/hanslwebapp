"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Clock, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const approvalData = [
  {
    id: "PO-002",
    item: "IT장비 구매",
    requester: "이영희",
    department: "개발팀",
    amount: "₩2,500,000",
    requestDate: "2024-01-14",
    priority: "긴급",
    description: "개발용 노트북 및 모니터 구매"
  },
  {
    id: "PO-004",
    item: "사무용 의자",
    requester: "정수진",
    department: "인사팀",
    amount: "₩450,000",
    requestDate: "2024-01-12",
    priority: "보통",
    description: "신입사원용 사무용 의자 구매"
  },
  {
    id: "PO-006",
    item: "회의실 장비",
    requester: "박민수",
    department: "기획팀",
    amount: "₩1,200,000",
    requestDate: "2024-01-11",
    priority: "보통",
    description: "화상회의 장비 및 프로젝터"
  }
];

export default function ApproveMain() {
  const [statusFilter, setStatusFilter] = useState("pending");

  const handleApprove = (id: string) => {
    console.log("승인:", id);
    alert(`발주서 ${id}가 승인되었습니다.`);
  };

  const handleReject = (id: string) => {
    console.log("반려:", id);
    alert(`발주서 ${id}가 반려되었습니다.`);
  };

  const handleViewDetail = (id: string) => {
    console.log("상세보기:", id);
    alert(`발주서 ${id} 상세보기`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-semibold text-foreground">승인 관리</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Purchase Order Approval Management</p>
        </div>
        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-9 text-sm bg-background border-border rounded-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-md">
              <SelectItem value="pending">승인대기</SelectItem>
              <SelectItem value="approved">승인완료</SelectItem>
              <SelectItem value="rejected">반려</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border rounded-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">승인 대기</p>
                <p className="text-xl font-semibold text-foreground">3건</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border rounded-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">승인 완료</p>
                <p className="text-xl font-semibold text-foreground">12건</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border rounded-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">반려</p>
                <p className="text-xl font-semibold text-foreground">1건</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Approval List */}
      <div className="space-y-4">
        {approvalData.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, type: "spring", damping: 25 }}
          >
            <Card className="border-border rounded-lg hover:shadow-md transition-all duration-200">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-foreground">{item.id}</h3>
                      <Badge 
                        className={`text-xs rounded-sm ${
                          item.priority === "긴급" 
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {item.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground mb-1">{item.item}</p>
                    <p className="text-xs text-muted-foreground mb-3">{item.description}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">요청자: </span>
                        <span className="text-foreground font-medium">{item.requester}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">부서: </span>
                        <span className="text-foreground">{item.department}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">금액: </span>
                        <span className="text-foreground font-medium">{item.amount}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">요청일: </span>
                        <span className="text-foreground">{item.requestDate}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetail(item.id)}
                    className="gap-2 rounded-md"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    상세보기
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-md"
                  >
                    <Download className="w-3.5 h-3.5" />
                    다운로드
                  </Button>
                  <div className="flex-1"></div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReject(item.id)}
                    className="gap-2 rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    반려
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(item.id)}
                    className="gap-2 rounded-md bg-success hover:bg-success/90 text-success-foreground"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    승인
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
