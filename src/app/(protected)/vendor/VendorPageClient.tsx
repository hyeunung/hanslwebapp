"use client";
// 이 파일은 클라이언트 컴포넌트입니다.
// 브라우저에서만 동작하는 애니메이션, 상태 관리 등은 여기서 처리합니다.
import { motion } from "framer-motion";
import VendorListMain from "@/components/vendor/VendorListMain";
import AppNavigationLayout from "@/components/layout/AppNavigationLayout";

// 실제 애니메이션 및 UI 렌더링을 담당하는 컴포넌트
export default function VendorPageClient() {
  return (
    <AppNavigationLayout initialTab="vendors">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: "spring", damping: 25 }}
      >
        {/* 벤더 리스트 메인 UI */}
        <VendorListMain />
      </motion.div>
    </AppNavigationLayout>
  );
} 