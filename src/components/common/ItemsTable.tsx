import React, { useMemo, useState } from 'react';
import { useReactTable, getCoreRowModel, flexRender, ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Save, X } from 'lucide-react';
import { nanoid } from 'nanoid';

interface Item {
  id: string;
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

interface ExtraRow {
  id: string;
  item_name: string;
  specification: string;
  quantity: string;
  unit_price: string;
  amount: string;
  remark: string;
}

interface ItemsTableProps {
  items: Item[];
  setItems: (items: Item[]) => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  onSubmit?: () => void;
  submitButtonText?: string;
  showSubmitButton?: boolean;
  showTotalSummary?: boolean;
  showCurrencySelector?: boolean;
  className?: string;
}

export default function ItemsTable({
  items,
  setItems,
  currency,
  onCurrencyChange,
  onSubmit,
  submitButtonText = '저장',
  showSubmitButton = true,
  showTotalSummary = true,
  showCurrencySelector = true,
  className = '',
}: ItemsTableProps) {
  const columns = useMemo<ColumnDef<Item, any>[]>(
    () => [
      {
        header: () => <div className="text-center">번호</div>,
        accessorKey: 'line_number',
        cell: ({ row }) => <div className="text-center">{row.index + 1}</div>,
        size: 24,
        minSize: 24,
        maxSize: 24,
        enableResizing: false,
        meta: { sticky: 'left', align: 'center' },
      },
      {
        header: () => <div className="text-left">품명</div>,
        accessorKey: 'item_name',
        cell: ({ row, getValue }) => (
          <Input
            value={getValue() ?? ''}
            onChange={e => handleItemChange(row.index, 'item_name', e.target.value)}
            placeholder="품명"
            className="h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none text-xs bg-white"
          />
        ),
        size: 120,
        minSize: 80,
        enableResizing: true,
        meta: { align: 'left' },
      },
      {
        header: () => <div className="text-left">규격</div>,
        accessorKey: 'specification',
        cell: ({ row, getValue }) => (
          <Input
            value={getValue() ?? ''}
            onChange={e => handleItemChange(row.index, 'specification', e.target.value)}
            placeholder="규격"
            className="h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none text-xs bg-white"
          />
        ),
        size: 100,
        minSize: 60,
        enableResizing: true,
        meta: { align: 'left' },
      },
      {
        header: () => <div className="text-center">수량</div>,
        accessorKey: 'quantity',
        cell: ({ row, getValue }) => (
          <div className="flex justify-center">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={getValue() ?? ''}
              onChange={e => handleItemChange(row.index, 'quantity', e.target.value.replace(/[^0-9]/g, ''))}
              className="h-8 px-2 border-0 shadow-none bg-transparent text-center rounded-none focus:ring-0 focus:outline-none text-xs bg-white w-16 min-w-[56px] max-w-[70px]"
            />
          </div>
        ),
        size: 70,
        minSize: 56,
        maxSize: 80,
        enableResizing: true,
        meta: { align: 'center' },
      },
      {
        header: () => <div className="text-right">단가 ({currency})</div>,
        accessorKey: 'unit_price_value',
        cell: ({ row, getValue }) => (
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={getValue() ?? ''}
            onChange={e => handleItemChange(row.index, 'unit_price_value', e.target.value.replace(/[^0-9]/g, ''))}
            className="h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none text-xs bg-white w-full min-w-0 text-right"
          />
        ),
        size: 100,
        minSize: 80,
        maxSize: 120,
        enableResizing: true,
        meta: { align: 'right' },
      },
      {
        header: () => <div className="text-right">금액({currency === 'KRW' ? '₩' : '$'})</div>,
        accessorKey: 'amount_value',
        cell: ({ row }) => {
          const item = items[row.index];
          const quantity = String(item.quantity) === '' ? 0 : Number(item.quantity);
          const unitPrice = String(item.unit_price_value) === '' ? 0 : Number(item.unit_price_value);
          const amount = quantity * unitPrice;
          return (
            <Input
              value={amount ? amount.toLocaleString() : '0'}
              disabled
              className="h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none text-xs bg-white w-full min-w-0 text-right"
            />
          );
        },
        size: 110,
        minSize: 90,
        maxSize: 130,
        enableResizing: true,
        meta: { align: 'right' },
      },
      {
        header: () => <div className="text-left">비고</div>,
        accessorKey: 'remark',
        cell: ({ row, getValue }) => (
          <Input
            value={getValue() ?? ''}
            onChange={e => handleItemChange(row.index, 'remark', e.target.value)}
            placeholder="비고(용도)"
            className="h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none text-xs bg-white"
          />
        ),
        size: 120,
        minSize: 80,
        enableResizing: true,
        meta: { align: 'left' },
      },
      {
        header: () => <div className="text-center">삭제</div>,
        id: 'delete',
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" className="h-7 w-14 min-w-[24px] max-w-[24px] p-0 text-xs" onClick={() => handleRemove(row.index)}>
              삭제
            </Button>
          </div>
        ),
        size: 24,
        minSize: 24,
        maxSize: 24,
        enableResizing: false,
        meta: { sticky: 'right', align: 'center' },
      },
    ],
    [currency, items]
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    debugTable: false,
    enableColumnResizing: true,
    columnResizeDirection: 'ltr',
  });

  const [extraRows, setExtraRows] = useState<ExtraRow[]>([]);

  function handleItemChange(index: number, key: keyof Item, value: any) {
    const newItems = [...items];
    let newValue = value;
    if (key === 'quantity' || key === 'unit_price_value') {
      newValue = String(value) === '' ? '' : String(value).replace(/^0+(?=\d)/, '');
    }
    newItems[index] = {
      ...newItems[index],
      [key]: newValue,
      amount_value:
        key === 'quantity' || key === 'unit_price_value'
          ? ((key === 'quantity' ? (String(value) === '' ? 0 : Number(value)) : (String(newItems[index].quantity) === '' ? 0 : Number(newItems[index].quantity))) *
            (key === 'unit_price_value' ? (String(value) === '' ? 0 : Number(value)) : (String(newItems[index].unit_price_value) === '' ? 0 : Number(newItems[index].unit_price_value))))
          : newItems[index].amount_value,
    };
    setItems(newItems);
  }

  function handleRemove(index: number) {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  }

  function handleAdd(count: number) {
    const newItems = [
      ...items,
      ...Array.from({ length: count }, (_, i) => ({
        id: nanoid(),
        line_number: items.length + i + 1,
        item_name: '',
        specification: '',
        quantity: 1,
        unit_price_value: 0,
        unit_price_currency: currency,
        amount_value: 0,
        amount_currency: currency,
        remark: '',
      })),
    ];
    setItems(newItems);
  }

  function handleExtraChange(index: number, key: keyof ExtraRow, value: string) {
    const newRows = [...extraRows];
    newRows[index] = {
      ...newRows[index],
      [key]: value,
      amount:
        key === 'quantity' || key === 'unit_price'
          ? String(
              (key === 'quantity' ? Number(value || '0') : Number(newRows[index].quantity || '0')) *
              (key === 'unit_price' ? Number(value || '0') : Number(newRows[index].unit_price || '0'))
            )
          : newRows[index].amount,
    };
    setExtraRows(newRows);
  }

  function handleExtraAdd() {
    setExtraRows([
      ...extraRows,
      {
        id: nanoid(),
        item_name: '',
        specification: '',
        quantity: '',
        unit_price: '',
        amount: '',
        remark: '',
      },
    ]);
  }

  function handleExtraRemove(index: number) {
    const newRows = [...extraRows];
    newRows.splice(index, 1);
    setExtraRows(newRows);
  }

  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price_value), 0);

  // 합계 계산
  const extraSum = extraRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  return (
    <div className={`space-y-4 ${className}`}>
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
      <div className="rounded-lg border border-border shadow-sm overflow-x-auto">
        <table className="w-full min-w-fit">
          <thead>
            <tr className="bg-[#f5f5f7] text-xs text-muted-foreground font-medium">
              <th className="text-center px-4 py-3 border-l border-[#e5e7eb]">번호</th>
              <th className="text-left px-4 py-3 border-l border-[#e5e7eb]">품명</th>
              <th className="text-left px-4 py-3 border-l border-[#e5e7eb]">규격</th>
              <th className="text-center px-4 py-3 border-l border-[#e5e7eb] text-center">수량</th>
              <th className="text-right px-4 py-3 border-l border-[#e5e7eb]">단가 ({currency})</th>
              <th className="text-right px-4 py-3 border-l border-[#e5e7eb]">합계 ({currency})</th>
              <th className="text-left px-4 py-3 border-l border-[#e5e7eb]">비고</th>
              <th className="text-center px-4 py-3 border-l border-r border-[#e5e7eb]"></th>
            </tr>
          </thead>
          <tbody>
            {extraRows.map((row, idx) => (
              <tr key={row.id} className={`text-xs bg-background border-b border-border${idx === extraRows.length - 1 ? ' last:border-b-0' : ''}`}>
                <td className="text-center px-4 border-l border-[#e5e7eb]">{idx + 1}</td>
                <td className="text-left px-4 border-l border-[#e5e7eb]">
                  <Input value={row.item_name} onChange={e => handleExtraChange(idx, 'item_name', e.target.value)} placeholder="품명" className="h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none text-xs bg-white w-full min-w-0" />
                </td>
                <td className="text-left px-4 border-l border-[#e5e7eb]">
                  <Input value={row.specification} onChange={e => handleExtraChange(idx, 'specification', e.target.value)} placeholder="규격" className="h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none text-xs bg-white w-full min-w-0" />
                </td>
                <td className="text-center px-4 border-l border-[#e5e7eb] text-center">
                  <Input value={row.quantity} onChange={e => handleExtraChange(idx, 'quantity', e.target.value.replace(/[^0-9]/g, ''))} placeholder="수량" className="h-8 px-2 border-0 shadow-none bg-transparent text-center rounded-none focus:ring-0 focus:outline-none text-xs bg-white w-full min-w-0" />
                </td>
                <td className="text-right px-4 border-l border-[#e5e7eb]">
                  <div className="flex items-center justify-end gap-1">
                    <Input value={row.unit_price ? Number(row.unit_price).toLocaleString() : ''} onChange={e => handleExtraChange(idx, 'unit_price', e.target.value.replace(/[^0-9]/g, ''))} placeholder="단가" className="h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none text-xs bg-white w-full min-w-0 text-right" />
                    <span className="text-xs text-gray-500">{currency}</span>
                  </div>
                </td>
                <td className="text-right px-4 border-l border-[#e5e7eb] text-black">
                  <div className="flex items-center justify-end gap-1">
                    <Input value={row.amount ? Number(row.amount).toLocaleString() : '0'} readOnly className="h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none text-xs bg-white w-full min-w-0 text-right text-black" />
                    <span className="text-xs text-gray-500">{currency}</span>
                  </div>
                </td>
                <td className="text-left px-4 border-l border-[#e5e7eb]">
                  <Input value={row.remark} onChange={e => handleExtraChange(idx, 'remark', e.target.value)} placeholder="비고(용도)" className="h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none text-xs bg-white w-full min-w-0" />
                </td>
                <td className="text-center px-4 border-l border-r border-[#e5e7eb]">
                  <Button size="sm" variant="ghost" onClick={() => handleExtraRemove(idx)} className="h-7 w-14 min-w-[24px] max-w-[24px] p-0 text-xs text-red-500">삭제</Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#f5f5f7] text-xs font-medium" style={{ borderTop: '4px solid #f5f5f7', borderBottom: '4px solid #f5f5f7' }}>
              <td className="text-center px-4 font-semibold border-l border-[#e5e7eb] min-w-[64px] w-[64px]">총 합계</td>
              <td className="px-4 border-l border-[#e5e7eb]" colSpan={4}></td>
              <td className="text-right px-4 font-semibold border-l border-[#e5e7eb] text-foreground">{extraSum ? extraSum.toLocaleString() : ''} <span className="text-xs text-gray-500">({currency})</span></td>
              <td className="px-4 border-l border-r border-[#e5e7eb]" colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="border-t border-border mt-2" />
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={1000}
            defaultValue={1}
            id="extra-add-count"
            className="w-14 h-8 text-xs text-right border border-border rounded-md px-2 shadow-sm hover:shadow-md focus:shadow-md transition-shadow duration-200 focus:ring-0 focus:outline-none"
            style={{ width: '4.5rem' }}
          />
          <Button
            variant="ghost"
            size="sm"
            className="text-primary text-xs h-8 px-3 hover:bg-primary/10 shadow-sm hover:shadow-md transition-shadow duration-200"
            onClick={() => {
              const input = document.getElementById('extra-add-count');
              const count = input ? Math.max(1, Math.min(1000, Number((input as HTMLInputElement).value))) : 1;
              for (let i = 0; i < count; i++) handleExtraAdd();
            }}
          >
            + 품목 추가
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="rounded-md px-4 text-muted-foreground hover:text-foreground shadow-sm hover:shadow-md transition-shadow duration-200"
            onClick={() => setExtraRows([{ id: nanoid(), item_name: '', specification: '', quantity: '', unit_price: '', amount: '', remark: '' }])}
          >
            전체 삭제
          </Button>
          <Button
            size="sm"
            className="gap-2 rounded-md px-6 bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-shadow duration-200 text-white"
            onClick={() => {/* TODO: 발주 요청 기능 구현 */}}
          >
            발주 요청
          </Button>
        </div>
      </div>
    </div>
  );
}
