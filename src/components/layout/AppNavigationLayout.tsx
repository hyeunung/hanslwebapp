"use client";
import { useState } from "react";
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

export default function AppNavigationLayout() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const { currentUserRoles } = usePurchaseData();

  let content = null;
  if (currentTab === 'dashboard') content = <DashboardMain />;
  else if (currentTab === 'new') content = <PurchaseNewMain />;
  else if (currentTab === 'list') content = <PurchaseListMain showEmailButton={false} />;
  else if (currentTab === 'approve') content = <ApproveMain />;
  else if (currentTab === 'vendors') content = <VendorListMain />;
  else if (currentTab === 'employee') content = <EmployeeMain />;

  // 관리자 권한 체크
  const isAdmin = currentUserRoles.includes('app_admin') || currentUserRoles.includes('final_approver') || currentUserRoles.includes('middle_manager');

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
                  onClick={() => setCurrentTab(item.id)}
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
