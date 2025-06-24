"use client";
// 이 파일은 클라이언트 컴포넌트입니다.
// 브라우저에서만 동작하는 애니메이션, 상태 관리 등은 여기서 처리합니다.
import { motion } from "framer-motion";
import PurchaseNewMain from "@/components/purchase/PurchaseNewMain";
import AppNavigationLayout from "@/components/layout/AppNavigationLayout";

// 실제 애니메이션 및 UI 렌더링을 담당하는 컴포넌트
export default function PurchaseNewPageClient() {
  return (
    <AppNavigationLayout initialTab="new">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: "spring", damping: 25 }}
        className="max-w-4xl mx-auto"
      >
        {/* 상단 제목 영역 */}
        <div className="mb-6">
          <h1 className="font-semibold text-foreground">
            <span className="drop-shadow-lg hover:drop-shadow-xl transition-all duration-300">➕</span> 새 발주서 작성
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Create New Purchase Order</p>
          {/* 제목 아래 나눔선 */}
          <hr className="mt-4 border-t border-border shadow-sm" />
        </div>
        {/* 실제 발주서 작성 폼 */}
        <div className="bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 p-6">
          <PurchaseNewMain />
        </div>
      </motion.div>
    </AppNavigationLayout>
  );
} 