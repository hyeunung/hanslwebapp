"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Save, Calculator, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multiselect";
import { DatePicker } from "@/components/ui/datepicker";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useColumnResize } from "@/hooks/useColumnResize";
import { ColumnResizer } from "@/hooks/ColumnResizer";
import { useForm as useFormRH, Controller, useFieldArray } from "react-hook-form";
import dynamic from 'next/dynamic';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
const ReactSelect = dynamic(() => import('react-select'), { ssr: false });

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

interface FormValues {
  vendor_id: number;
  contacts: string[];
  purchase_order_number: string;
  sales_order_number: string;
  project_vendor: string;
  project_item: string;
  delivery_request_date: string;
  progress_type: string;
  payment_category: string;
  currency: string;
  po_template_type: string;
  request_type: string;
  request_date: string;
  items: Item[];
}

export default function PurchaseNewMain() {
  const { user } = useAuth();
  const router = useRouter();
  const [vendors, setVendors] = useState<{ id: number; vendor_name: string }[]>([]);
  const [contacts, setContacts] = useState<{ id: number; contact_name: string; contact_email: string; contact_phone: string; position: string }[]>([]);
  const [vendor, setVendor] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [requester, setRequester] = useState(user?.user_metadata?.name || "");
  const [billingDate, setBillingDate] = useState(new Date());
  const [arrivalDate, setArrivalDate] = useState(new Date());
  const [currency, setCurrency] = useState("KRW");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [addCount, setAddCount] = useState(1);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState<{ id?: number; contact_name: string; contact_email: string; contact_phone: string; position: string }>({ contact_name: '', contact_email: '', contact_phone: '', position: '' });
  const [contactEditMode, setContactEditMode] = useState<'add' | 'edit'>('add');
  const [contactEditTarget, setContactEditTarget] = useState<number | null>(null);

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
    disableResizeCols: ['action'],
  });

  const { control, handleSubmit: rhHandleSubmit, watch, setValue, reset } = useFormRH<FormValues>({
    defaultValues: {
      progress_type: "일반",
      payment_category: "발주",
      currency: "KRW",
      po_template_type: "일반",
      request_type: "원자재",
      contacts: [],
      purchase_order_number: '',
      sales_order_number: '',
      project_vendor: '',
      project_item: '',
      delivery_request_date: '',
      vendor_id: 0,
      items: [
        {
          line_number: 1,
          item_name: "",
          specification: "",
          quantity: 1,
          unit_price_value: 0,
          unit_price_currency: "KRW",
          amount_value: 0,
          amount_currency: "KRW",
          remark: "",
        },
      ],
      request_date: new Date().toISOString().slice(0, 10),
    },
  });

  const { fields, append, remove, update } = useFieldArray<FormValues, 'items'>({
    control,
    name: 'items',
  });

  const selectedVendor = watch('vendor_id');
  useEffect(() => {
    supabase.from('vendors').select('id, vendor_name').then(({ data }) => {
      if (data) setVendors(data);
    });
  }, []);

  useEffect(() => {
    if (selectedVendor) {
      supabase.from('vendor_contacts').select('id, contact_name, contact_email, contact_phone, position').eq('vendor_id', selectedVendor).then(({ data }) => {
        if (data) setContacts(data);
      });
    } else {
      setContacts([]);
      setValue('contacts', []);
    }
  }, [selectedVendor]);

  useEffect(() => {
    fields.forEach((item, idx) => update(idx, { ...item, unit_price_currency: currency, amount_currency: currency }));
  }, [currency]);

  const handleSubmit = async () => {
    if (!user) {
      setError("로그인이 필요합니다.");
      return;
    }
    if (!vendor || fields.length === 0) {
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
        request_date: watch('request_date'),
        delivery_request_date: watch('delivery_request_date'),
        currency,
        total_amount: fields.reduce((sum, i) => sum + i.amount_value, 0),
        request_type: watch('request_type'),
        sales_order_number: watch('sales_order_number'),
        project_vendor: watch('project_vendor'),
        project_item: watch('project_item'),
        progress_type: watch('progress_type'),
        payment_category: watch('payment_category'),
        po_template_type: watch('po_template_type'),
        contacts: watch('contacts'),
      }).select("id").single();
      if (prError || !pr) throw prError || new Error("등록 실패");
      const prId = pr.id;
      for (const [idx, item] of fields.entries()) {
        const { error: itemErr } = await supabase.from("purchase_request_items").insert({
          purchase_request_id: prId,
          line_number: idx + 1,
          item_name: item.item_name,
          specification: item.specification,
          quantity: item.quantity,
          unit_price_value: item.unit_price_value,
          unit_price_currency: currency,
          amount_value: item.amount_value,
          amount_currency: currency,
          remark: item.remark,
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

  const totalAmount = fields.reduce((sum, item) => sum + item.amount_value, 0);

  const openAddContact = () => {
    setContactDraft({ contact_name: '', contact_email: '', contact_phone: '', position: '' });
    setContactEditMode('add');
    setIsContactDialogOpen(true);
  };

  const openEditContact = (c: { id: number; contact_name: string; contact_email: string; contact_phone: string; position: string }) => {
    setContactDraft({ ...c });
    setContactEditMode('edit');
    setContactEditTarget(c.id);
    setIsContactDialogOpen(true);
  };

  const handleContactSave = async () => {
    if (!selectedVendor) return;
    if (!contactDraft.contact_name.trim() || !contactDraft.contact_email.trim()) return;
    if (contactEditMode === 'add') {
      await supabase.from('vendor_contacts').insert({
        vendor_id: selectedVendor,
        contact_name: contactDraft.contact_name,
        contact_email: contactDraft.contact_email,
        contact_phone: contactDraft.contact_phone,
        position: contactDraft.position,
      });
    } else if (contactEditMode === 'edit' && contactEditTarget) {
      await supabase.from('vendor_contacts').update({
        contact_name: contactDraft.contact_name,
        contact_email: contactDraft.contact_email,
        contact_phone: contactDraft.contact_phone,
        position: contactDraft.position,
      }).eq('id', contactEditTarget);
    }
    const { data } = await supabase.from('vendor_contacts').select('id, contact_name, contact_email, contact_phone, position').eq('vendor_id', selectedVendor);
    if (data) setContacts(data);
    setIsContactDialogOpen(false);
  };

  const handleContactDelete = async (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    await supabase.from('vendor_contacts').delete().eq('id', id);
    const { data } = await supabase.from('vendor_contacts').select('id, contact_name, contact_email, contact_phone, position').eq('vendor_id', selectedVendor);
    if (data) setContacts(data);
  };

      return (
     <div className="space-y-6">
       {/* 발주 기본 정보 */}
       <div className="bg-muted/20 border border-border rounded-lg p-5 space-y-4">
         <div className="flex flex-col justify-center mb-4">
           <h4 className="font-semibold text-foreground">발주 기본 정보</h4>
           <p className="text-xs text-muted-foreground mt-0.5">Basic Information</p>
         </div>

         <div className="space-y-4">
           {/* 요청 설정 */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
             <div>
               <Label className="mb-1 block">요청 유형</Label>
               <Select value={watch('request_type')} onValueChange={(value) => setValue('request_type', value)}>
                 <SelectTrigger className="h-9 bg-white border border-[#d2d2d7] rounded-md">
                   <SelectValue placeholder="요청 유형을 선택하세요" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="원자재">원자재</SelectItem>
                   <SelectItem value="소모품">소모품</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <div>
               <Label className="mb-1 block">진행 종류</Label>
               <Select value={watch('progress_type')} onValueChange={(value) => setValue('progress_type', value)}>
                 <SelectTrigger className="h-9 bg-white border border-[#d2d2d7] rounded-md">
                   <SelectValue placeholder="진행 종류를 선택하세요" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="일반">일반</SelectItem>
                   <SelectItem value="선진행">선진행</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <div>
               <Label className="mb-1 block">결제 종류</Label>
               <Select value={watch('payment_category')} onValueChange={(value) => setValue('payment_category', value)}>
                 <SelectTrigger className="h-9 bg-white border border-[#d2d2d7] rounded-md">
                   <SelectValue placeholder="결제 종류를 선택하세요" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="발주">발주</SelectItem>
                   <SelectItem value="구매 요청">구매 요청</SelectItem>
                   <SelectItem value="현장 결제">현장 결제</SelectItem>
                 </SelectContent>
               </Select>
             </div>
           </div>

           {/* 업체 정보 */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
             <div>
               <Label className="mb-1 block">업체명</Label>
               <ReactSelect
                 options={vendors.map(v => ({ value: v.id.toString(), label: v.vendor_name }))}
                 value={vendors.find(v => v.id.toString() === vendor) ? { value: vendor, label: vendors.find(v => v.id.toString() === vendor)?.vendor_name } : null}
                 onChange={(option, _action) => {
                   const opt = option as { value: string; label: string } | null;
                   if (opt) {
                     setVendor(opt.value);
                     setValue('vendor_id', Number(opt.value));
                   } else {
                     setVendor('');
                     setValue('vendor_id', 0);
                   }
                 }}
                 placeholder="업체를 검색/선택하세요"
                 isClearable
                 isSearchable
                 closeMenuOnSelect={true}
                 classNamePrefix="vendor-select"
                 styles={{
                   container: base => ({ ...base, width: '100%' }),
                   control: base => ({ ...base, height: 36, minHeight: 36, background: '#fff', border: '1px solid #d2d2d7', borderRadius: 6 }),
                   valueContainer: base => ({ ...base, height: 36, padding: '0 12px' }),
                   input: base => ({ ...base, margin: 0, padding: 0 }),
                   indicatorsContainer: base => ({ ...base, height: 36 }),
                   menuPortal: base => ({ ...base, zIndex: 1400 })
                 }}
               />
             </div>
             <div>
               <div className="flex items-center gap-2 mb-1">
                 <Label>담당자</Label>
                 <span
                   className="text-primary text-xs cursor-pointer hover:underline select-none"
                   onClick={openAddContact}
                 >
                   +수정/추가
                 </span>
               </div>
               <MultiSelect
                 options={contacts.map(c => ({ value: c.id.toString(), label: c.contact_name || c.contact_email || c.contact_phone || c.position || '' }))}
                 value={watch('contacts')}
                 onChange={val => setValue('contacts', val)}
                 placeholder="담당자를 선택하세요"
               />
               {/* 담당자 추가/수정 모달 */}
               <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
                 <DialogContent>
                   <DialogHeader>
                     <DialogTitle>{contactEditMode === 'add' ? '담당자 추가' : '담당자 수정'}</DialogTitle>
                   </DialogHeader>
                   {/* 담당자 목록 */}
                   {contacts.length > 0 && (
                     <div className="flex flex-wrap gap-2 mb-2">
                       {contacts.map(c => (
                         <div key={c.id} className="flex items-center gap-1 px-2 py-1 bg-muted rounded border text-xs">
                           <span>{c.contact_name || c.contact_email || c.contact_phone || c.position || ''}</span>
                           <Button type="button" size="icon" variant="ghost" className="w-5 h-5 p-0" onClick={() => {
                             setContactDraft({ ...c });
                             setContactEditMode('edit');
                             setContactEditTarget(c.id);
                           }}><Pencil className="w-3 h-3" /></Button>
                           <Button type="button" size="icon" variant="ghost" className="w-5 h-5 p-0" onClick={() => handleContactDelete(c.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                         </div>
                       ))}
                     </div>
                   )}
                   <div className="space-y-2">
                     <Label>이름*</Label>
                     <Input value={contactDraft.contact_name} onChange={e => setContactDraft(d => ({ ...d, contact_name: e.target.value }))} />
                     <Label>이메일*</Label>
                     <Input value={contactDraft.contact_email} onChange={e => setContactDraft(d => ({ ...d, contact_email: e.target.value }))} />
                     <Label>전화</Label>
                     <Input value={contactDraft.contact_phone} onChange={e => setContactDraft(d => ({ ...d, contact_phone: e.target.value }))} />
                     <Label>직급</Label>
                     <Input value={contactDraft.position} onChange={e => setContactDraft(d => ({ ...d, position: e.target.value }))} />
                   </div>
                   <DialogFooter>
                     <Button onClick={handleContactSave}>{contactEditMode === 'add' ? '추가' : '저장'}</Button>
                     <DialogClose asChild>
                       <Button variant="outline">취소</Button>
                     </DialogClose>
                   </DialogFooter>
                 </DialogContent>
               </Dialog>
             </div>
           </div>

           {/* 일정 정보 */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
             <div>
               <Label className="mb-1 block">청구일</Label>
               <DatePicker 
                 value={watch('request_date') ? new Date(watch('request_date')) : new Date()} 
                 onChange={date => setValue('request_date', date ? date.toISOString().slice(0, 10) : '')} 
               />
             </div>
             <div>
               <Label className="mb-1 block">입고 요청일</Label>
               <DatePicker 
                 value={watch('delivery_request_date') ? new Date(watch('delivery_request_date')) : new Date()} 
                 onChange={date => setValue('delivery_request_date', date ? date.toISOString().slice(0, 10) : '')} 
               />
             </div>
           </div>

           {/* 프로젝트 정보 */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
             <div>
               <Label className="mb-1 block">구매요구자</Label>
               <Input 
                 type="text" 
                 value={requester} 
                 onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRequester(e.target.value)} 
                 className="bg-white border border-[#d2d2d7] rounded-md"
               />
             </div>
             <div>
               <Label className="mb-1 block">PJ업체</Label>
               <Input 
                 type="text" 
                 value={watch('project_vendor')} 
                 onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue('project_vendor', e.target.value)} 
                 className="bg-white border border-[#d2d2d7] rounded-md"
               />
             </div>
             <div>
               <Label className="mb-1 block">수주번호</Label>
               <Input 
                 type="text" 
                 value={watch('sales_order_number')} 
                 onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue('sales_order_number', e.target.value)} 
                 className="bg-white border border-[#d2d2d7] rounded-md"
               />
             </div>
             <div>
               <Label className="mb-1 block">Item</Label>
               <Input 
                 type="text" 
                 value={watch('project_item')} 
                 onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue('project_item', e.target.value)} 
                 className="bg-white border border-[#d2d2d7] rounded-md"
               />
             </div>
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
          {fields.map((item, idx) => (
            <div
              key={item.id}
              className={`grid items-center text-xs bg-background ${idx !== fields.length - 1 ? 'border-b border-border' : ''}`}
              style={{ gridTemplateColumns: `${colWidths.number}px ${colWidths.name}px ${colWidths.spec}px ${colWidths.quantity}px ${colWidths.price}px ${colWidths.total}px ${colWidths.note}px 40px` }}
            >
              <span className="px-2 py-2 border-r border-border text-center" style={{ width: colWidths.number }}>{idx + 1}</span>
              <Input
                value={item.item_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => update(idx, { ...item, item_name: e.target.value })}
                placeholder="품명"
                className="h-8 px-2 border-0 border-r border-border shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none text-xs bg-white"
                style={{ width: colWidths.name }}
              />
              <Input
                value={item.specification}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => update(idx, { ...item, specification: e.target.value })}
                placeholder="규격"
                className="h-8 px-2 border-0 border-r border-border shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none text-xs bg-white"
                style={{ width: colWidths.spec }}
              />
              <Input
                type="text"
                value={item.quantity || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const newQty = Number(e.target.value.replace(/[^0-9]/g, ''));
                  update(idx, { ...item, quantity: newQty, amount_value: newQty * item.unit_price_value });
                }}
                className="h-8 px-2 border-0 border-r border-border shadow-none bg-transparent text-center rounded-none focus:ring-0 focus:outline-none text-xs bg-white"
                style={{ width: colWidths.quantity }}
              />
              <Input
                type="text"
                value={item.unit_price_value || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const newPrice = Number(e.target.value.replace(/[^0-9]/g, ''));
                  update(idx, { ...item, unit_price_value: newPrice, amount_value: item.quantity * newPrice });
                }}
                className="h-8 px-2 border-0 border-r border-border shadow-none bg-transparent text-right rounded-none focus:ring-0 focus:outline-none text-xs bg-white"
                style={{ width: colWidths.price }}
              />
              <Input
                value={item.amount_value ? item.amount_value.toLocaleString() : ''}
                disabled
                className="h-8 px-2 border-0 border-r border-border shadow-none bg-transparent text-right rounded-none focus:ring-0 focus:outline-none text-xs bg-white"
                style={{ width: colWidths.total }}
              />
              <Input
                value={item.remark}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => update(idx, { ...item, remark: e.target.value })}
                placeholder="비고(용도)"
                className="h-8 px-2 border-0 border-r border-border shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none text-xs bg-white"
                style={{ width: colWidths.note }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(idx)}
                disabled={fields.length === 1}
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
                  {fields.filter(item => item.item_name).length}개 품목
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
            품목 추가
          </span>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-md px-4 text-muted-foreground hover:text-foreground"
            onClick={() => {
              for (let i = fields.length - 1; i >= 0; i--) remove(i);
            }}
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
