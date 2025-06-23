import Image from "next/image";
import { Building2 } from "lucide-react";
import React from "react";

interface HeaderBrandProps {
  /**
   * 로고 타입: 'image'는 이미지, 'icon'은 아이콘
   */
  logoType?: "image" | "icon";
  /**
   * 로고의 width(px, 소수점 가능)
   */
  logoWidth?: number;
  /**
   * 로고의 height(px, 소수점 가능)
   */
  logoHeight?: number;
  /**
   * 로고의 margin-top(px, 소수점 가능)
   */
  marginTopLogo?: number;
  /**
   * 로고의 margin-left(px, 소수점 가능)
   */
  marginLeftLogo?: number;
  /**
   * 제목(HANSL)의 font-size(px, 소수점 가능)
   */
  titleFontSize?: number;
  /**
   * 제목(HANSL)의 margin-top(px, 소수점 가능)
   */
  marginTopTitle?: number;
  /**
   * 제목(HANSL)의 margin-left(px, 소수점 가능)
   */
  marginLeftTitle?: number;
  /**
   * 부제(MANAGEMENT SYSTEM)의 font-size(px, 소수점 가능)
   */
  subtitleFontSize?: number;
  /**
   * 부제(MANAGEMENT SYSTEM)의 font-weight(숫자, 예: 400, 500, 600)
   */
  subtitleFontWeight?: number;
  /**
   * 부제(MANAGEMENT SYSTEM)의 margin-top(px, 소수점 가능)
   */
  marginTopSubtitle?: number;
  /**
   * 부제(MANAGEMENT SYSTEM)의 margin-left(px, 소수점 가능)
   */
  marginLeftSubtitle?: number;
}

/**
 * HANSL 브랜드 헤더 컴포넌트
 * - 로고, 제목, 부제목을 한 줄에 표시
 * - 각 요소의 크기/마진을 소수점 단위로 조절 가능
 * - logoType으로 이미지/아이콘 선택 가능
 * - 부제목의 글자 굵기도 조절 가능
 *
 * @param logoType 'image' | 'icon' - 로고 타입 선택
 * @param logoWidth, logoHeight - 로고 크기(px, 소수점 가능)
 * @param marginTopLogo, marginLeftLogo - 로고 위치 미세조정(px, 소수점 가능)
 * @param titleFontSize - 제목(HANSL) 폰트 크기(px, 소수점 가능)
 * @param marginTopTitle, marginLeftTitle - 제목 위치 미세조정(px, 소수점 가능)
 * @param subtitleFontSize - 부제 폰트 크기(px, 소수점 가능)
 * @param subtitleFontWeight - 부제 글자 굵기(숫자)
 * @param marginTopSubtitle, marginLeftSubtitle - 부제 위치 미세조정(px, 소수점 가능)
 */
export default function HeaderBrand({
  logoType = "image",
  logoWidth = 39,
  logoHeight = 39,
  marginTopLogo = 0,
  marginLeftLogo = 10,
  titleFontSize = 31,
  marginTopTitle = 0,
  marginLeftTitle = 12,
  subtitleFontSize = 11,
  subtitleFontWeight = 500,
  marginTopSubtitle = -2,
  marginLeftSubtitle = 13.5,
}: HeaderBrandProps) {
  return (
    <div className="flex items-start gap-0">
      {/* 로고: 이미지 또는 아이콘, 크기/위치 모두 소수점 단위로 조절 가능 */}
      {logoType === "image" ? (
        <Image
          src="/logo_symbol.svg"
          alt="로고"
          width={logoWidth}
          height={logoHeight}
          className="self-center"
          style={{ objectFit: "contain", marginTop: marginTopLogo, marginLeft: marginLeftLogo }}
        />
      ) : (
        <Building2 size={logoWidth} className="text-primary self-center" style={{ marginTop: marginTopLogo, marginLeft: marginLeftLogo }} />
      )}
      {/* 텍스트 묶음: 제목(HANSL) + 부제(MANAGEMENT SYSTEM) */}
      <div className="flex flex-col justify-center items-start ml-0">
        {/* 제목(HANSL): 크기/위치 모두 소수점 단위로 조절 가능 */}
        <h1
          className="font-bold text-[#636464] leading-none self-start"
          style={{ fontSize: `${titleFontSize}px`, marginTop: marginTopTitle, marginLeft: marginLeftTitle }}
        >
          HANSL
        </h1>
        {/* 부제(MANAGEMENT SYSTEM): 크기/굵기/위치 모두 소수점 단위로 조절 가능 */}
        <span
          className="text-muted-foreground self-start"
          style={{ fontSize: `${subtitleFontSize}px`, fontWeight: subtitleFontWeight, marginTop: marginTopSubtitle, marginLeft: marginLeftSubtitle }}
        >
          MANAGEMENT SYSTEM
        </span>
      </div>
    </div>
  );
}
