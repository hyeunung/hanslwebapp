"use client";
import { Building2 } from "lucide-react";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

interface CommonLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export default function CommonLayout({ children, title, description }: CommonLayoutProps) {
  const pathname = usePathname();

  const getNavLinkClass = (path: string) => {
    const isActive = pathname === path;
    return `flex items-center space-x-2 py-4 px-2 border-b-2 transition-colors ${
      isActive
        ? 'border-primary text-primary'
        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
    }`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="bg-white border-b border-border shadow-sm sticky top-0 z-50">
        <div className="flex items-center justify-between h-16 px-8">
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
          <a
            href="/dashboard"
            className={getNavLinkClass('/dashboard')}
          >
            <span className="text-sm font-medium">대시보드</span>
          </a>
          <a
            href="/purchase/new"
            className={getNavLinkClass('/purchase/new')}
          >
            <span className="text-sm font-medium">새 발주</span>
          </a>
          <a
            href="/purchase/list"
            className={getNavLinkClass('/purchase/list')}
          >
            <span className="text-sm font-medium">발주 목록</span>
          </a>
          <a
            href="/purchase/approve"
            className={getNavLinkClass('/purchase/approve')}
          >
            <span className="text-sm font-medium">승인 관리</span>
          </a>
          <a
            href="/vendor"
            className={getNavLinkClass('/vendor')}
          >
            <span className="text-sm font-medium">업체 관리</span>
          </a>
        </div>
      </nav>
      
      {/* 메인 컨텐츠 */}
      <main className="w-full max-w-none px-8 py-8">
        {title && (
          <div className="mb-6">
            <h1 className="font-semibold text-foreground">
              {title === "새 발주서 작성" ? (
                <>
                  <span className="drop-shadow-lg hover:drop-shadow-xl transition-all duration-300">➕</span> {title}
                </>
              ) : (
                title
              )}
            </h1>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            {/* 제목 아래 나눔선 */}
            <div className="mt-4 h-px bg-gray-300 shadow-md"></div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}