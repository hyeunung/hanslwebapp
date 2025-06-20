import React from "react";
import HeaderBrand from "./HeaderBrand";
import LogoutButton from "./LogoutButton";

interface HeaderBarProps {
  /**
   * 'image' | 'icon' - 로고 타입
   */
  logoType?: "image" | "icon";
  // brandProps 제거
}

/**
 * 헤더 바 전체(로고+제목+부제+로그아웃) 공통 컴포넌트
 * - logoType: 'image' | 'icon' (기본: image)
 * - brandProps: HeaderBrand에 전달할 상세 옵션
 */
export default function HeaderBar({ logoType = "image" }: HeaderBarProps) {
  return (
    <div className="flex items-center h-20 px-6 justify-between">
      <HeaderBrand logoType={logoType} />
      <LogoutButton />
    </div>
  );
}
