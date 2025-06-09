import { useRef, useState } from 'react';

export interface UseColumnResizeOptions {
  columns: string[];
  minWidths: Record<string, number>;
  defaultWidths: Record<string, number>;
  storageKey: string;
  getHeaderText: (col: string) => string;
  getDataTexts: (col: string) => string[];
  disableResizeCols?: string[];
}

export function useColumnResize({
  columns,
  minWidths,
  defaultWidths,
  storageKey,
  getHeaderText,
  getDataTexts,
  disableResizeCols = [],
}: UseColumnResizeOptions) {
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : defaultWidths;
    }
    return defaultWidths;
  });
  const resizingCol = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  const onResizeMouseDown = (col: string) => (e: React.MouseEvent<HTMLDivElement>) => {
    if (disableResizeCols.includes(col)) return;
    resizingCol.current = col;
    startX.current = e.clientX;
    startWidth.current = colWidths[col];
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', onResizeMouseMove as any);
    window.addEventListener('mouseup', onResizeMouseUp as any, { once: true });
  };
  const onResizeMouseMove = (e: MouseEvent) => {
    if (!resizingCol.current) return;
    const diff = e.clientX - startX.current;
    setColWidths((prev: Record<string, number>) => {
      const col = resizingCol.current as string;
      const next = { ...prev, [col]: Math.max(minWidths[col], startWidth.current + diff) };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };
  const onResizeMouseUp = () => {
    resizingCol.current = null;
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', onResizeMouseMove as any);
  };

  const handleResizeDoubleClick = (col: string) => {
    if (disableResizeCols.includes(col)) return;
    const headerText = getHeaderText(col);
    const dataTexts = getDataTexts(col);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.font = '12px inherit';
    const allTexts = [headerText, ...dataTexts];
    const maxTextWidth = Math.max(...allTexts.map(text => ctx.measureText(text).width));
    const padding = 16 + 12;
    const newWidth = Math.ceil(maxTextWidth + padding);
    setColWidths((prev: Record<string, number>) => {
      const next = { ...prev, [col]: Math.max(minWidths[col], newWidth) };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  function getResizerProps(col: string) {
    return {
      onMouseDown: onResizeMouseDown(col),
      onDoubleClick: () => handleResizeDoubleClick(col),
      style: disableResizeCols.includes(col) ? { pointerEvents: 'none' as const, opacity: 0.3 } : {},
    };
  }

  return {
    colWidths,
    setColWidths,
    getResizerProps,
  };
}
