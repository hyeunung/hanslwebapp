"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Save, Calculator } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multiselect";
import { DatePicker } from "@/components/ui/datepicker";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useColumnResize } from "@/hooks/useColumnResize";
import { ColumnResizer } from "@/hooks/ColumnResizer";

interface ItemRow {
  id: string;
  name: string;
  spec: string;
  quantity: number;
  price: number;
  total: number;
  note: string;
}

export default function PurchaseNewMain() {
  const { user } = useAuth();
  const router = useRouter();
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [vendor, setVendor] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [requester, setRequester] = useState(user?.user_metadata?.name || "");
  const [billingDate, setBillingDate] = useState(new Date());
  const [orderNumber, setOrderNumber] = useState("");
  const [arrivalDate, setArrivalDate] = useState(new Date());
  const [currency, setCurrency] = useState("KRW");
  const [items, setItems] = useState<ItemRow[]>([
    { id: "1", name: "", spec: "", quantity: 1, price: 0, total: 0, note: "" }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [addCount, setAddCount] = useState(1);

  const userId = user?.id || 'guest';
  const storageKey = `purchase_colwidths_${userId}`;
  const columns = ['number','name','spec','quantity','price','total','note','action'];
  const minWidths: Record<string, number> = {
    number: 40,
    name: 80,
    spec: 60,
    quantity: 50,
    price: 80,
    total: 80,
    note: 80,
    action: 40
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
      case 'action': return '삭제';
      default: return '';
    }
  };
  const getDataTexts = (col: string) => items.map(item => {
    switch (col) {
      case 'number': return String(items.indexOf(item) + 1);
      case 'name': return item.name || '';
      case 'spec': return item.spec || '';
      case 'quantity': return item.quantity ? item.quantity.toString() : '';
      case 'price': return item.price ? item.price.toLocaleString() : '';
      case 'total': return item.total ? item.total.toLocaleString() : '';
      case 'note': return item.note || '';
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
    disableResizeCols: ['action'],
  });

  const addItem = () => {
    const newItem: ItemRow = {
      id: Date.now().toString(),
      name: "",
      spec: "",
      quantity: 0,
      price: 0,
      total: 0,
      note: ""
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof ItemRow, value: string | number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'price') {
          updated.total = updated.quantity * updated.price;
        }
        return updated;
      }
      return item;
    }));
  };

  useEffect(() => {
    supabase.from("vendors").select("id, vendor_name").then(({ data }) => {
      if (data) setVendors(data.map((v: any) => ({ id: v.id.toString(), name: v.vendor_name })));
    });
  }, []);

  useEffect(() => {
    if (vendor) {
      supabase.from("vendor_contacts").select("id, contact_name").eq("vendor_id", vendor).then(({ data }) => {
        if (data) setContacts(data.map((c: any) => ({ id: c.id.toString(), name: c.contact_name })));
      });
    } else {
      setContacts([]);
      setSelectedContacts([]);
    }
  }, [vendor]);

  const handleSubmit = async () => {
    if (!user) {
      setError("로그인이 필요합니다.");
      return;
    }
    if (!vendor || items.length === 0) {
      setError("업체와 품목을 입력하세요.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { data: pr, error: prError } = await supabase.from("purchase_requests").insert({
        requester_id: user.id,
        requester_name: user.user_metadata?.name,
        vendor_id: vendor,
        purchase_order_number: orderNumber,
        request_date: billingDate.toISOString().slice(0, 10),
        delivery_request_date: arrivalDate.toISOString().slice(0, 10),
        currency,
        total_amount: items.reduce((sum, i) => sum + i.total, 0),
      }).select("id").single();
      if (prError || !pr) throw prError || new Error("등록 실패");
      const prId = pr.id;
      for (const [idx, item] of items.entries()) {
        const { error: itemErr } = await supabase.from("purchase_request_items").insert({
          purchase_request_id: prId,
          line_number: idx + 1,
          item_name: item.name,
          specification: item.spec,
          quantity: item.quantity,
          unit_price_value: item.price,
          unit_price_currency: currency,
          amount_value: item.total,
          amount_currency: currency,
          remark: item.note,
        });
        if (itemErr) throw itemErr;
      }
      setSuccess("발주 요청이 성공적으로 등록되었습니다.");
      setTimeout(() => router.push("/purchase/list"), 1000);
    } catch (err: any) {
      setError(err.message || "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="space-y-6">
      {/* Professional Basic Info Section */}
      <div className="bg-muted/20 border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">발주 기본 정보</h3>
          <Badge variant="outline" className="text-xs">Basic Information</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>업체명</Label>
            <Select value={vendor} onValueChange={setVendor}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="업체를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>구매요구자</Label>
            <Input value={requester} onChange={e => setRequester(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>담당자</Label>
            <MultiSelect
              options={contacts.map(c => ({ value: c.id, label: c.name }))}
              value={selectedContacts}
              onChange={setSelectedContacts}
              placeholder="담당자를 선택하세요"
            />
          </div>
          <div className="space-y-2">
            <Label>청구일</Label>
            <DatePicker value={billingDate} onChange={setBillingDate} />
          </div>
          <div className="space-y-2">
            <Label>발주번호</Label>
            <Input value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="자동/수동" />
          </div>
          <div className="space-y-2">
            <Label>입고 요청일</Label>
            <DatePicker value={arrivalDate} onChange={setArrivalDate} />
          </div>
        </div>
      </div>

      {/* Professional Items Section */}
      <div className="space-y-4">
        <div className="flex items-center mb-2">
          <div className="flex flex-col justify-center">
            <h4 className="font-semibold text-foreground">품목 목록</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Purchase Items</p>
          </div>
          <div className="ml-[15px]">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-20 h-8 text-xs border-border rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-md">
                <SelectItem value="KRW">KRW</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* DB 스타일 테이블 박스 */}
        <div className="rounded-lg border border-border overflow-hidden">
          {/* 헤더 */}
          <div className="grid bg-muted/10 text-xs text-muted-foreground font-medium" style={{ gridTemplateColumns: `${colWidths.number}px ${colWidths.name}px ${colWidths.spec}px ${colWidths.quantity}px ${colWidths.price}px ${colWidths.total}px ${colWidths.note}px 40px` }}>
            {/* 번호 */}
            <div className="px-2 py-3 border-r border-border text-center relative group" style={{ width: colWidths.number }}>
              번호
              <ColumnResizer {...getResizerProps('number')} />
            </div>
            {/* 품명 */}
            <div className="px-2 py-3 border-r border-border relative group" style={{ width: colWidths.name }}>
              품명
              <ColumnResizer {...getResizerProps('name')} />
            </div>
            {/* 규격 */}
            <div className="px-2 py-3 border-r border-border relative group" style={{ width: colWidths.spec }}>
              규격
              <ColumnResizer {...getResizerProps('spec')} />
            </div>
            {/* 수량 */}
            <div className="px-2 py-3 border-r border-border text-center relative group" style={{ width: colWidths.quantity }}>
              수량
              <ColumnResizer {...getResizerProps('quantity')} />
            </div>
            {/* 단가 */}
            <div className="px-2 py-3 border-r border-border text-right relative group" style={{ width: colWidths.price }}>
              단가({currency === 'KRW' ? '₩' : '$'})
              <ColumnResizer {...getResizerProps('price')} />
            </div>
            {/* 금액 */}
            <div className="px-2 py-3 border-r border-border text-right relative group" style={{ width: colWidths.total }}>
              금액({currency === 'KRW' ? '₩' : '$'})
              <ColumnResizer {...getResizerProps('total')} />
            </div>
            {/* 비고 */}
            <div className="px-2 py-3 border-r border-border relative group" style={{ width: colWidths.note }}>
              비고
              <ColumnResizer {...getResizerProps('note')} />
            </div>
            {/* 삭제(X) - 맨 오른쪽, border-r 없음 */}
            <div className="px-2 py-3 text-center relative group bg-muted/10" style={{ width: 40, right: 0, position: 'sticky', zIndex: 2 }}>
              삭제
            </div>
          </div>
          {/* 데이터 행 */}
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`grid items-center text-xs bg-background ${idx !== items.length - 1 ? 'border-b border-border' : ''}`}
              style={{ gridTemplateColumns: `${colWidths.number}px ${colWidths.name}px ${colWidths.spec}px ${colWidths.quantity}px ${colWidths.price}px ${colWidths.total}px ${colWidths.note}px 40px` }}
            >
              <span className="px-2 py-2 border-r border-border text-center" style={{ width: colWidths.number }}>{idx + 1}</span>
              <Input
                value={item.name}
                onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                placeholder="품명"
                className="h-8 px-2 border-0 border-r border-border shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none text-xs"
                style={{ width: colWidths.name }}
              />
              <Input
                value={item.spec}
                onChange={(e) => updateItem(item.id, 'spec', e.target.value)}
                placeholder="규격"
                className="h-8 px-2 border-0 border-r border-border shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none text-xs"
                style={{ width: colWidths.spec }}
              />
              <Input
                type="text"
                value={item.quantity || ''}
                onChange={e => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  updateItem(item.id, 'quantity', value ? parseInt(value) : 0);
                }}
                className="h-8 px-2 border-0 border-r border-border shadow-none bg-transparent text-center rounded-none focus:ring-0 focus:outline-none text-xs"
                style={{ width: colWidths.quantity }}
              />
              <Input
                type="text"
                value={item.price ? item.price.toLocaleString() : ''}
                onChange={e => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  updateItem(item.id, 'price', value ? parseInt(value) : 0);
                }}
                className="h-8 px-2 border-0 border-r border-border shadow-none bg-transparent text-right rounded-none focus:ring-0 focus:outline-none text-xs"
                style={{ width: colWidths.price }}
              />
              <Input
                value={item.total ? item.total.toLocaleString() : ''}
                disabled
                className="h-8 px-2 border-0 border-r border-border shadow-none bg-transparent text-right rounded-none focus:ring-0 focus:outline-none text-xs"
                style={{ width: colWidths.total }}
              />
              <Input
                value={item.note}
                onChange={(e) => updateItem(item.id, 'note', e.target.value)}
                placeholder="비고(용도)"
                className="h-8 px-2 border-0 border-r border-border shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none text-xs"
                style={{ width: colWidths.note }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeItem(item.id)}
                disabled={items.length === 1}
                className="w-6 h-6 p-0 rounded-none hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 text-xs bg-background"
                style={{ width: 40, right: 0, position: 'sticky', zIndex: 1 }}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>

        {/* Professional Total Summary */}
        {totalAmount > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">총 발주 금액</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-primary">
                  {currency === "KRW" ? "₩" : "$"}{totalAmount.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {items.filter(item => item.name).length}개 품목
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Professional Action Bar */}
      <div className="flex justify-between items-center pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={1000}
            value={addCount}
            onChange={e => setAddCount(Math.max(1, Math.min(1000, Number(e.target.value))))}
            className="w-14 h-8 text-xs border border-border rounded-md px-2 focus:ring-0 focus:outline-none"
            style={{ width: '4.5rem' }}
          />
          <span
            className="text-primary text-xs cursor-pointer hover:underline select-none"
            onClick={() => {
              const newItems = Array.from({ length: addCount }, () => ({
                id: Date.now().toString() + Math.random().toString(36).slice(2),
                name: '', spec: '', quantity: 1, price: 0, total: 0, note: ''
              }));
              setItems([...items, ...newItems]);
            }}
          >
            품목 추가
          </span>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-md px-4 text-muted-foreground hover:text-foreground"
            onClick={() => setItems([{ id: Date.now().toString(), name: '', spec: '', quantity: 1, price: 0, total: 0, note: '' }])}
          >
            전체 삭제
          </Button>
          <Button 
            onClick={handleSubmit} 
            size="sm" 
            className="gap-2 rounded-md px-6 bg-primary hover:bg-primary/90"
          >
            <Save className="w-3.5 h-3.5" />
            발주 요청
          </Button>
        </div>
      </div>
    </div>
  );
}
