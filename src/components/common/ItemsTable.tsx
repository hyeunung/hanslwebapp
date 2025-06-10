'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFieldArray, Control } from 'react-hook-form';
import { X, Calculator, Save } from 'lucide-react';
import { useColumnResize } from '@/hooks/useColumnResize';

interface Item {
  line_number: number;
  item_name: string;
  specification: string;
  quantity: number;
  unit_price_value: number;
  unit_price_currency: string;
  amount_value: number;
  amount_currency: string;
  remark: string;
}

interface ItemsTableProps {
  control: Control<any>;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  onSubmit?: () => void;
  userId?: string;
  submitButtonText?: string;
  showSubmitButton?: boolean;
  showTotalSummary?: boolean;
  showCurrencySelector?: boolean;
  className?: string;
}

export default function ItemsTable({
  control,
  currency,
  onCurrencyChange,
  onSubmit,
  userId = 'guest',
  submitButtonText = '저장',
  showSubmitButton = true,
  showTotalSummary = true,
  showCurrencySelector = true,
  className = ''
}: ItemsTableProps) {
  const [addCount, setAddCount] = useState(1);

  const { fields, append, remove, update } = useFieldArray<{ items: Item[] }, 'items'>({
    control,
    name: 'items',
  });

  const storageKey = `items_table_colwidths_${userId}`;
  const columns = ['number','name','spec','quantity','price','total','note'];
  const minWidths: Record<string, number> = {
    number: 40,
    name: 80,
    spec: 60,
    quantity: 50,
    price: 80,
    total: 80,
    note: 80
  };
  const defaultWidths = minWidths;

  const getHeaderText = (col: string) => {
    switch (col) {
      case 'number': return '번호';
      case 'name': return '품명';
      case 'spec': return '규격';
      case 'quantity': return '수량';
      case 'price': return `단가(${currency === 'KRW' ? '₩' : '$'})`;
      case 'total': return `금액(${currency === 'KRW' ? '₩' : '$'})`;
      case 'note': return '비고';
      default: return '';
    }
  };

  const getDataTexts = (col: string) => fields.map(item => {
    switch (col) {
      case 'number': return String(fields.indexOf(item) + 1);
      case 'name': return item.item_name || '';
      case 'spec': return item.specification || '';
      case 'quantity': return item.quantity ? item.quantity.toString() : '';
      case 'price': return item.unit_price_value ? item.unit_price_value.toLocaleString() : '';
      case 'total': return item.amount_value ? item.amount_value.toLocaleString() : '';
      case 'note': return item.remark || '';
      default: return '';
    }
  });

  const { colWidths, getResizerProps } = useColumnResize({
    columns,
    minWidths,
    defaultWidths,
    storageKey,
    getHeaderText,
    getDataTexts,
    disableResizeCols: [],
  });

  const totalAmount = fields.reduce((sum, item) => sum + (item.amount_value || 0), 0);

  const ColumnResizer = ({ onMouseDown, onTouchStart }: any) => (
    <div
      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity"
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    />
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 통화 선택 */}
      {showCurrencySelector && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">통화:</label>
          <Select value={currency} onValueChange={onCurrencyChange}>
            <SelectTrigger className="w-24 h-8 bg-white border border-[#d2d2d7] rounded-md text-xs shadow-sm hover:shadow-md transition-shadow duration-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-md">
              <SelectItem value="KRW">KRW</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 테이블 */}
      <div className="rounded-lg border border-border shadow-sm overflow-hidden">
        {/* 헤더 */}
        <div className="grid bg-muted/10 text-xs text-muted-foreground font-medium" style={{ gridTemplateColumns: `${colWidths.number}px ${colWidths.name}px ${colWidths.spec}px ${colWidths.quantity}px ${colWidths.price}px ${colWidths.total}px ${colWidths.note}px` }}>
          {/* 번호 */}
          <div className="px-2 py-3 text-center relative group after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border" style={{ width: colWidths.number }}>
            번호
            <ColumnResizer {...getResizerProps('number')} />
          </div>
          {/* 품명 */}
          <div className="px-2 py-3 relative group after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border" style={{ width: colWidths.name }}>
            품명
            <ColumnResizer {...getResizerProps('name')} />
          </div>
          {/* 규격 */}
          <div className="px-2 py-3 relative group after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border" style={{ width: colWidths.spec }}>
            규격
            <ColumnResizer {...getResizerProps('spec')} />
          </div>
          {/* 수량 */}
          <div className="px-2 py-3 text-center relative group after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border" style={{ width: colWidths.quantity }}>
            수량
            <ColumnResizer {...getResizerProps('quantity')} />
          </div>
          {/* 단가 */}
          <div className="px-2 py-3 text-right relative group after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border" style={{ width: colWidths.price }}>
            단가({currency === 'KRW' ? '₩' : '$'})
            <ColumnResizer {...getResizerProps('price')} />
          </div>
          {/* 금액 */}
          <div className="px-2 py-3 text-right relative group after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border" style={{ width: colWidths.total }}>
            금액({currency === 'KRW' ? '₩' : '$'})
            <ColumnResizer {...getResizerProps('total')} />
          </div>
          {/* 비고 */}
          <div className="px-2 py-3 relative group" style={{ width: colWidths.note }}>
            비고
            <ColumnResizer {...getResizerProps('note')} />
          </div>
        </div>

        {/* 데이터 행 */}
        {fields.map((item, idx) => (
          <div
            key={item.id}
            className={`grid items-center text-xs bg-background ${idx !== fields.length - 1 ? 'border-b border-border' : ''}`}
            style={{ gridTemplateColumns: `${colWidths.number}px ${colWidths.name}px ${colWidths.spec}px ${colWidths.quantity}px ${colWidths.price}px ${colWidths.total}px ${colWidths.note}px` }}
          >
            <div className="relative after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border" style={{ width: colWidths.number }}>
              <span className="px-2 py-2 text-center block">{idx + 1}</span>
            </div>
            <div className="relative after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border" style={{ width: colWidths.name }}>
              <Input
                value={item.item_name}
                onChange={(e) => update(idx, { ...item, item_name: e.target.value })}
                placeholder="품명"
                className="h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none text-xs bg-white"
              />
            </div>
            <div className="relative after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border" style={{ width: colWidths.spec }}>
              <Input
                value={item.specification}
                onChange={(e) => update(idx, { ...item, specification: e.target.value })}
                placeholder="규격"
                className="h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none text-xs bg-white"
              />
            </div>
            <div className="relative after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border" style={{ width: colWidths.quantity }}>
              <Input
                type="text"
                value={item.quantity || ''}
                onChange={(e) => {
                  const newQty = Number(e.target.value.replace(/[^0-9]/g, ''));
                  update(idx, { ...item, quantity: newQty, amount_value: newQty * item.unit_price_value });
                }}
                className="h-8 px-2 border-0 shadow-none bg-transparent text-center rounded-none focus:ring-0 focus:outline-none text-xs bg-white"
              />
            </div>
            <div className="relative after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border" style={{ width: colWidths.price }}>
              <Input
                type="text"
                value={item.unit_price_value || '0'}
                onChange={(e) => {
                  const newPrice = Number(e.target.value.replace(/[^0-9]/g, ''));
                  update(idx, { ...item, unit_price_value: newPrice, amount_value: item.quantity * newPrice });
                }}
                className="h-8 px-2 border-0 shadow-none bg-transparent text-right rounded-none focus:ring-0 focus:outline-none text-xs bg-white"
              />
            </div>
            <div className="relative after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border" style={{ width: colWidths.total }}>
              <Input
                value={item.amount_value ? item.amount_value.toLocaleString() : '0'}
                disabled
                className="h-8 px-2 border-0 shadow-none bg-transparent text-right rounded-none focus:ring-0 focus:outline-none text-xs bg-white"
              />
            </div>
            <div className="relative" style={{ width: colWidths.note }}>
              <Input
                value={item.remark}
                onChange={(e) => update(idx, { ...item, remark: e.target.value })}
                placeholder="비고(용도)"
                className="h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none text-xs bg-white"
              />
            </div>
          </div>
        ))}
      </div>

      {/* 총합 표시 */}
      {showTotalSummary && totalAmount > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg shadow hover:shadow-sm transition-shadow duration-300 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">총 금액</span>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-primary">
                {currency === "KRW" ? "₩" : "$"}{totalAmount.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                {fields.filter(item => item.item_name).length}개 품목
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 액션 바 */}
      <div className="flex justify-between items-center pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={1000}
            value={addCount}
            onChange={e => setAddCount(Math.max(1, Math.min(1000, Number(e.target.value))))}
            className="w-14 h-8 text-xs border border-border rounded-md px-2 shadow-sm hover:shadow-md focus:shadow-md transition-shadow duration-200 focus:ring-0 focus:outline-none"
            style={{ width: '4.5rem' }}
          />
          <Button
            variant="ghost"
            size="sm"
            className="text-primary text-xs h-8 px-3 hover:bg-primary/10 shadow-sm hover:shadow-md transition-shadow duration-200"
            onClick={() => {
              const newItems = Array.from({ length: addCount }, () => ({
                line_number: fields.length + 1,
                item_name: '',
                specification: '',
                quantity: 1,
                unit_price_value: 0,
                unit_price_currency: currency,
                amount_value: 0,
                amount_currency: currency,
                remark: '',
              }));
              append(newItems);
            }}
          >
            + 품목 추가
          </Button>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-md px-4 text-muted-foreground hover:text-foreground shadow-sm hover:shadow-md transition-shadow duration-200"
            onClick={() => {
              for (let i = fields.length - 1; i >= 0; i--) remove(i);
            }}
          >
            전체 삭제
          </Button>
          {showSubmitButton && onSubmit && (
            <Button 
              onClick={onSubmit} 
              size="sm" 
              className="gap-2 rounded-md px-6 bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-shadow duration-200"
            >
              <Save className="w-3.5 h-3.5" />
              {submitButtonText}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
} 