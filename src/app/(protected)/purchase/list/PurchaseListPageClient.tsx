"use client";
import AppNavigationLayout from "@/components/layout/AppNavigationLayout";

export default function PurchaseListPageClient() {
  // AppNavigationLayout 자체의 'list' 탭 화면을 그대로 사용하여
  // SPA 내 탭 전환과 동일한 DOM 구조를 유지한다.
  return <AppNavigationLayout initialTab="list" />;
}