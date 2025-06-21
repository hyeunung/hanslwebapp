"use client";
import { Building2 } from "lucide-react";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import HeaderBar from "./HeaderBar";

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
        ? 'border-white text-white'
        : 'border-transparent text-white hover:text-white hover:border-border'
    }`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 */}
      <header className="bg-white border-b border-border shadow-sm sticky top-0 z-50">
  <HeaderBar logoType="icon" />
</header>
      
      {/* 네비게이션 */}
      <nav className="bg-gradient-to-r from-primary to-white border-b border-border shadow-sm">
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
      <main className="flex-1 flex flex-col min-h-0 w-full max-w-none px-8 py-8">
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
