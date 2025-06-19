// ColumnResizer.tsx
// 이 파일은 테이블(표)에서 컬럼(열)의 너비를 마우스로 조절할 수 있게 해주는 리사이저(Resizer) 컴포넌트입니다.
// 사용자가 마우스로 드래그하거나 더블클릭하여 열의 크기를 조정할 수 있습니다.
// 비전공자도 이해할 수 있도록 각 부분에 한글로 상세 주석을 추가했습니다.

import React from 'react';

// [타입 정의] 컬럼 리사이저 컴포넌트에 전달되는 props(속성) 설명
interface ColumnResizerProps {
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void; // 마우스 드래그 시작 시 실행되는 함수
  onDoubleClick?: () => void; // (선택) 더블클릭 시 실행되는 함수
  style?: React.CSSProperties; // (선택) 추가 스타일 지정
}

// [컴포넌트] 테이블 열의 오른쪽 끝에 표시되는 리사이저 바
// 사용자가 이 바를 마우스로 드래그하면 열의 너비를 조절할 수 있습니다.
export const ColumnResizer: React.FC<ColumnResizerProps> = ({ onMouseDown, onDoubleClick, style }) => (
  <div
    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize group-hover:bg-primary/30 z-10" // 위치, 크기, 커서, 색상 등 스타일 지정
    onMouseDown={onMouseDown} // 마우스 드래그 시작 이벤트 연결
    onDoubleClick={onDoubleClick} // 더블클릭 이벤트 연결(있을 경우)
    style={style} // 추가 스타일 적용(있을 경우)
  />
);
