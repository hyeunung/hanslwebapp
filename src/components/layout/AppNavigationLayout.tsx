"use client";
import { useState } from "react";
import { Building2, Home, FileText, Users, CheckCircle, Plus } from "lucide-react";
import DashboardMain from "@/components/dashboard/DashboardMain";
import PurchaseNewMain from "@/components/purchase/PurchaseNewMain";
import PurchaseListMain from "@/components/purchase/PurchaseListMain";
import ApproveMain from "@/components/approve/ApproveMain";
import VendorListMain from "@/components/vendor/VendorListMain";
import LogoutButton from "./LogoutButton";

// 네비게이션 항목 정의
const navigationItems = [
  { id: 'dashboard', icon: Home, label: '대시보드' },
  { id: 'new', icon: Plus, label: '새 발주' },
  { id: 'list', icon: FileText, label: '발주 목록' },
  { id: 'approve', icon: CheckCircle, label: '승인 관리' },
  { id: 'vendors', icon: Users, label: '업체 관리' },
];

// SPA 스타일 네비+헤더 레이아웃 컴포넌트
export default function AppNavigationLayout() {
  const [currentTab, setCurrentTab] = useState('dashboard');

  // 탭에 따라 메인 컨텐츠 변경
  let content = null;
  if (currentTab === 'dashboard') content = <DashboardMain />;
  else if (currentTab === 'new') content = <PurchaseNewMain />;
  else if (currentTab === 'list') content = <PurchaseListMain showEmailButton={false} />;
  else if (currentTab === 'approve') content = <ApproveMain />;
  else if (currentTab === 'vendors') content = <VendorListMain />;

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="bg-white border-b border-border shadow-sm sticky top-0 z-50">
        <div className="flex items-center h-16 px-8 justify-between">
          <div className="flex items-center">
            <Building2 size={24} className="text-primary" />
            <h1 className="text-xl font-semibold text-foreground ml-4">HANSL</h1>
            <span className="text-sm text-muted-foreground ml-2">구매 관리 시스템</span>
          </div>
          <LogoutButton />
        </div>
      </header>
      {/* 네비게이션 */}
      <nav className="bg-white border-b border-border shadow-sm">
        <div className="flex items-center space-x-8 px-8">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`flex items-center space-x-2 py-4 px-2 border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <Icon size={18} />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      {/* 메인 컨텐츠 */}
      <main className="flex-1 flex flex-col min-h-0 w-full max-w-none px-8 py-8">
        {content}
      </main>
    </div>
  );
} 