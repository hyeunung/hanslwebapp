"use client";
import { useState } from "react";
import { Building2, Home, FileText, Users, CheckCircle, Plus } from "lucide-react";
import DashboardMain from "@/components/dashboard/DashboardMain";
import PurchaseNewMain from "@/components/purchase/PurchaseNewMain";
import PurchaseListMain from "@/components/purchase/PurchaseListMain";
import ApproveMain from "@/components/approve/ApproveMain";
import VendorListMain from "@/components/vendor/VendorListMain";
import LogoutButton from "./LogoutButton";

// 아래는 상단 메뉴(네비게이션)에 들어갈 항목(버튼) 목록입니다.
// 각 항목은 id(내부 식별자), icon(아이콘), label(화면에 보이는 이름)으로 구성되어 있습니다.
const navigationItems = [
  { id: 'dashboard', icon: Home, label: '대시보드' }, // 대시보드: 전체 요약 화면
  { id: 'new', icon: Plus, label: '새 발주' },        // 새 발주: 새로 주문서 작성
  { id: 'list', icon: FileText, label: '발주 목록' },  // 발주 목록: 기존 주문서 목록
  { id: 'approve', icon: CheckCircle, label: '승인 관리' }, // 승인 관리: 결재/승인 관리
  { id: 'vendors', icon: Users, label: '업체 관리' },  // 업체 관리: 거래처 관리
];

// 이 함수가 실제로 화면에 보이는 레이아웃 전체를 만듭니다.
export default function AppNavigationLayout() {
  // 현재 어떤 메뉴(탭)가 선택되어 있는지 기억하는 상태입니다.
  // 예: '대시보드'를 누르면 dashboard, '발주 목록'을 누르면 list가 저장됩니다.
  const [currentTab, setCurrentTab] = useState('dashboard');

  // 위에서 선택된 메뉴에 따라 실제로 보여줄 화면(컴포넌트)을 결정합니다.
  let content = null;
  if (currentTab === 'dashboard') content = <DashboardMain />;
  else if (currentTab === 'new') content = <PurchaseNewMain />;
  else if (currentTab === 'list') content = <PurchaseListMain showEmailButton={false} />;
  else if (currentTab === 'approve') content = <ApproveMain />;
  else if (currentTab === 'vendors') content = <VendorListMain />;

  // 아래가 실제로 화면에 그려지는 부분입니다.
  // 1. 상단 헤더(로고, 시스템명, 로그아웃)
  // 2. 메뉴(네비게이션 바)
  // 3. 본문(선택된 화면)
  return (
    <div className="min-h-screen bg-background">
      {/* 상단 헤더: 로고, 시스템명, 로그아웃 버튼이 있습니다. 항상 화면 맨 위에 고정됩니다. */}
      <header className="bg-white border-b border-border shadow-sm sticky top-0 z-50">
        <div className="flex items-center h-16 px-8 justify-between">
          <div className="flex items-center">
            <Building2 size={24} className="text-primary" />
            <h1 className="text-xl font-semibold text-foreground ml-4">HANSL</h1>
            <span className="text-sm text-muted-foreground ml-2">구매 관리 시스템</span>
          </div>
          <LogoutButton /> {/* 로그아웃 버튼 */}
        </div>
      </header>
      {/* 메뉴(네비게이션 바): 각 메뉴를 누르면 화면이 바뀝니다. 이 바도 화면 상단에 고정됩니다. */}
      <nav className="bg-white border-b border-border shadow-sm sticky top-16 z-40">
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
                    ? 'border-primary text-primary' // 선택된 메뉴는 색이 진하게 표시됩니다.
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border' // 선택 안된 메뉴는 흐리게, 마우스 올리면 진해집니다.
                }`}
              >
                <Icon size={18} />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      {/* 본문: 위에서 선택한 메뉴에 따라 다른 화면이 이곳에 표시됩니다. */}
      <main className="flex-1 flex flex-col min-h-0 w-full max-w-none px-8 py-8">
        {content}
      </main>
    </div>
  );
} 