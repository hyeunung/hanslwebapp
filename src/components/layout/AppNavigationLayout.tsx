"use client";
import { useState, Suspense } from "react";
import Image from "next/image";
import { Building2, Home, FileText, Users, CheckCircle, Plus } from "lucide-react";
import DashboardMain from "@/components/dashboard/DashboardMain";
import PurchaseNewMain from "@/components/purchase/PurchaseNewMain";
import PurchaseListMain from "@/components/purchase/PurchaseListMain";
import ApproveMain from "@/components/approve/ApproveMain";
import VendorListMain from "@/components/vendor/VendorListMain";
import LogoutButton from "./LogoutButton";
import { usePurchaseData } from "@/hooks/usePurchaseData";
import HeaderBar from "./HeaderBar";
import HeaderBrand from "./HeaderBrand";
import EmployeeMain from "@/components/employee/EmployeeMain";

const navigationItems = [
  { id: 'dashboard', icon: Home, label: '대시보드' },
  { id: 'new', icon: Plus, label: '새 발주' },
  { id: 'list', icon: FileText, label: '발주 목록' },
  { id: 'approve', icon: CheckCircle, label: '승인 관리', adminOnly: true },
  { id: 'vendors', icon: Building2, label: '업체 관리' },
  { id: 'employee', icon: Users, label: '직원관리', adminOnly: true },
];

interface AppNavigationLayoutProps {
  /** 초기 선택 탭 (대시보드, 새 발주, 목록 등) */
  initialTab?: 'dashboard' | 'new' | 'list' | 'approve' | 'vendors' | 'employee';
  /** 메인 컨텐츠를 재정의할 때 사용. children 이 전달되면 내부 탭별 렌더링 대신 children 을 그대로 출력 */
  children?: React.ReactNode;
}

export default function AppNavigationLayout({ initialTab = 'dashboard', children }: AppNavigationLayoutProps) {
  const { currentUserRoles } = usePurchaseData();

  // 네비 탭은 state 로 관리하되, 초기값을 props 로 지정 가능
  const [currentTab, setCurrentTab] = useState(initialTab);

  // children 이 전달된 경우, overrideContent 로 사용
  let content: React.ReactNode = null;
  if (currentTab === initialTab && children) {
    content = children;
  } else {
    if (currentTab === 'dashboard') content = (
      <Suspense fallback={null}>
        <DashboardMain />
      </Suspense>
    );
    else if (currentTab === 'new') content = <PurchaseNewMain />;
    else if (currentTab === 'list') content = <PurchaseListMain showEmailButton={false} />;
    else if (currentTab === 'approve') content = <ApproveMain />;
    else if (currentTab === 'vendors') content = <VendorListMain />;
    else if (currentTab === 'employee') content = <EmployeeMain />;
  }

  // 관리자 권한 체크
  const isAdmin = currentUserRoles.includes('app_admin') || currentUserRoles.includes('ceo') || currentUserRoles.includes('final_approver') || currentUserRoles.includes('middle_manager');

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b border-border shadow-sm sticky top-0 z-50">
        <HeaderBar logoType="image" />
      </header>
      <nav className="bg-gradient-to-r from-primary to-white border-b border-border shadow-sm sticky top-16 z-40">
        <div className="flex items-center space-x-8 px-8">
          {navigationItems
            .filter(item => item.id === 'employee' || !item.adminOnly || isAdmin)
            .map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id as any)}
                  className={`flex items-center space-x-2 py-4 px-2 border-b-2 transition-colors ${
                    isActive
                      ? 'border-white text-white'
                      : 'border-transparent text-white hover:text-white hover:border-border'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
        </div>
      </nav>
      <main className="flex-1 flex flex-col min-h-0 w-full max-w-none px-8 py-8">
        {content}
      </main>
    </div>
  );
}
