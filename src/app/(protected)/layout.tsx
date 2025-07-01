"use client";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    // 로딩 중이 아니고 사용자가 없을 때만 리다이렉트
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);
  
  // 로딩 중이매 빈 화면 또는 로딩 스피너 표시
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // 인증되지 않은 사용자라면 빈 화면 (리다이렉트 진행 중)
  if (!user) {
    return null;
  }
  
  return <>{children}</>;
} 