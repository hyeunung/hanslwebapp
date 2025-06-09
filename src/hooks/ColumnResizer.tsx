import React from 'react';

interface ColumnResizerProps {
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDoubleClick?: () => void;
  style?: React.CSSProperties;
}

export const ColumnResizer: React.FC<ColumnResizerProps> = ({ onMouseDown, onDoubleClick, style }) => (
  <div
    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize group-hover:bg-primary/30 z-10"
    onMouseDown={onMouseDown}
    onDoubleClick={onDoubleClick}
    style={style}
  />
);
