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
  requester_name: string;
  items: Item[];
}

interface EmployeeOption {
  value: string;
  label: string;
}

export default function PurchaseNewMain() {
  const { user } = useAuth();
  const router = useRouter();
  const [employeeName, setEmployeeName] = useState<string>("");
  const [employees, setEmployees] = useState<{email: string; name: string; department?: string; position?: string}[]>([]);
  
    // 직원 목록 로드 및 현재 사용자 설정
  useEffect(() => {
    // 회사 직원 목록 (추후 DB 테이블로 이관 가능)
    const employeeList = [
      { email: 'admin@hansl.co.kr', name: '관리자', department: '관리팀', position: '관리자' },
      { email: 'ceo@hansl.co.kr', name: '대표이사', department: '경영진', position: '대표이사' },
      { email: 'manager@hansl.co.kr', name: '부장', department: '영업팀', position: '부장' },
      { email: 'staff@hansl.co.kr', name: '직원', department: '일반팀', position: '사원' },
      { email: 'john.doe@hansl.co.kr', name: '홍길동', department: '구매팀', position: '대리' },
      { email: 'jane.smith@hansl.co.kr', name: '김영희', department: '구매팀', position: '과장' },
      { email: 'park.chul@hansl.co.kr', name: '박철수', department: '영업팀', position: '차장' },
      { email: 'lee.min@hansl.co.kr', name: '이민수', department: '기술팀', position: '팀장' },
      // 실제 직원 이메일들을 여기에 추가
    ];

    // 직원 목록 설정
    setEmployees(employeeList);

    // DB에서 추가 직원 목록 가져오기 (테이블이 있다면)
    supabase
      .from('employees')
      .select('name, email, department, position')
      .then(({ data, error }) => {
        if (data && !error && data.length > 0) {
          // DB에서 가져온 직원들을 기존 목록과 합치기 (DB 우선)
          const mergedEmployees = data.map(dbEmp => ({
            email: dbEmp.email,
            name: dbEmp.name,
            department: dbEmp.department,
            position: dbEmp.position
          }));
          
          // 기본 목록에서 DB에 없는 직원들만 추가
          const additionalEmployees = employeeList.filter(listEmp => 
            !data.some(dbEmp => dbEmp.email === listEmp.email)
          );
          
          setEmployees([...mergedEmployees, ...additionalEmployees]);
        }
      });

    // 현재 로그인한 사용자의 이름을 기본값으로 설정
    if (user?.email) {
      const currentEmployee = employeeList.find(emp => emp.email === user.email);
      if (currentEmployee) {
        setEmployeeName(currentEmployee.name);
        if (setValue) setValue('requester_name', currentEmployee.name);
      } else {
        // DB에서 조회 시도
        supabase
          .from('employees')
          .select('name, email')
          .eq('email', user.email)
          .single()
          .then(({ data, error }) => {
            if (data && !error) {
              setEmployeeName(data.name);
              if (setValue) setValue('requester_name', data.name);
              // DB에서 가져온 직원도 목록에 추가
              setEmployees(prev => [...prev, { email: data.email, name: data.name }]);
            } else {
              // 매핑에도 없고 DB에도 없으면 이메일 앞부분 사용
              const fallbackName = user.email?.split('@')[0] || "사용자";
              setEmployeeName(fallbackName);
              if (setValue) setValue('requester_name', fallbackName);
              // 현재 사용자도 목록에 추가
              setEmployees(prev => [...prev, { email: user.email!, name: fallbackName }]);
            }
          });
      }
    }
  }, [user]);
  const [vendors, setVendors] = useState<{ id: number; vendor_name: string }[]>([]);
  const [contacts, setContacts] = useState<{ id: number; contact_name: string; contact_email: string; contact_phone: string; position: string }[]>([]);
  const [vendor, setVendor] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [billingDate, setBillingDate] = useState(new Date());
  const [arrivalDate, setArrivalDate] = useState(new Date());
  const [currency, setCurrency] = useState("KRW");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [addCount, setAddCount] = useState(1);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [contactsForEdit, setContactsForEdit] = useState<{ id?: number; contact_name: string; contact_email: string; contact_phone: string; position: string; isNew?: boolean }[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

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
      progress_type: "",
      payment_category: "",
      currency: "KRW",
      po_template_type: "일반",
      request_type: "",
      contacts: [],
      sales_order_number: '',
      project_vendor: '',
      project_item: '',
      delivery_request_date: '',
      vendor_id: 0,
      requester_name: "",
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
        requester_name: watch('requester_name'),
        requester_phone: user.user_metadata?.phone,
        requester_fax: user.user_metadata?.fax,
        requester_address: user.user_metadata?.address,
        vendor_id: vendor,
        sales_order_number: watch('sales_order_number'),
        project_vendor: watch('project_vendor'),
        project_item: watch('project_item'),
        request_date: watch('request_date'),
        delivery_request_date: watch('delivery_request_date'),
        request_type: watch('request_type'),
        progress_type: watch('progress_type'),
        payment_status: '대기',
        payment_category: watch('payment_category'),
        currency,
        total_amount: fields.reduce((sum, i) => sum + i.amount_value, 0),
        unit_price_currency: fields[0]?.unit_price_currency || currency,
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

  const openContactsManager = () => {
    // 기존 담당자들을 복사하고 새로운 담당자 추가를 위한 빈 슬롯도 추가
    const existingContacts = contacts.map(c => ({ ...c, isNew: false }));
    const newEmptyContact = { contact_name: '', contact_email: '', contact_phone: '', position: '', isNew: true };
    setContactsForEdit([...existingContacts, newEmptyContact]);
    setHasChanges(false);
    setIsContactDialogOpen(true);
  };

  const handleContactChange = (index: number, field: string, value: string) => {
    setContactsForEdit(prev => prev.map((contact, i) => 
      i === index ? { ...contact, [field]: value } : contact
    ));
    setHasChanges(true);
  };

  const addNewContactSlot = () => {
    setContactsForEdit(prev => [...prev, { contact_name: '', contact_email: '', contact_phone: '', position: '', isNew: true }]);
    setHasChanges(true);
  };

  const removeContactSlot = (index: number) => {
    setContactsForEdit(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleSaveAllContacts = async () => {
    if (!selectedVendor) return;

    try {
      // 기존 담당자 업데이트
      for (const contact of contactsForEdit.filter(c => !c.isNew && c.id)) {
        if (contact.contact_name.trim() || contact.contact_email.trim()) {
          await supabase.from('vendor_contacts').update({
            contact_name: contact.contact_name,
            contact_email: contact.contact_email,
            contact_phone: contact.contact_phone,
            position: contact.position,
          }).eq('id', contact.id);
        }
      }

      // 새로운 담당자 추가
      const newContacts = contactsForEdit.filter(c => c.isNew && (c.contact_name.trim() || c.contact_email.trim()));
      if (newContacts.length > 0) {
        await supabase.from('vendor_contacts').insert(
          newContacts.map(c => ({
            vendor_id: selectedVendor,
            contact_name: c.contact_name,
            contact_email: c.contact_email,
            contact_phone: c.contact_phone,
            position: c.position,
          }))
        );
      }

      // 데이터 새로고침
      const { data } = await supabase.from('vendor_contacts').select('id, contact_name, contact_email, contact_phone, position').eq('vendor_id', selectedVendor);
      if (data) setContacts(data);
      
      setIsContactDialogOpen(false);
      setHasChanges(false);
    } catch (error) {
      console.error('담당자 저장 중 오류:', error);
    }
  };

  const handleDeleteContact = async (contactId: number) => {
    if (!selectedVendor || !contactId) return;
    
    try {
      await supabase.from('vendor_contacts').delete().eq('id', contactId);
      
      // 화면에서도 제거
      setContactsForEdit(prev => prev.filter(c => c.id !== contactId));
      setHasChanges(true);
    } catch (error) {
      console.error('담당자 삭제 중 오류:', error);
    }
  };

      return (
     <div className="space-y-6">
       {/* 발주 기본 정보 - 좌측 1/4 폭 */}
       <div className="w-1/4 bg-muted/20 border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 p-5 space-y-4">
         <div className="flex flex-col justify-center mb-4">
           <h4 className="font-semibold text-foreground">발주 기본 정보</h4>
           <p className="text-xs text-muted-foreground mt-0.5">Basic Information</p>
         </div>

         <div className="space-y-4">
           {/* 요청 설정 */}
           <div className="grid grid-cols-3 gap-2">
             <div>
               <Label className="mb-1 block text-xs">요청 유형</Label>
               <Select value={watch('request_type')} onValueChange={(value) => setValue('request_type', value)}>
                 <SelectTrigger className="h-8 bg-white border border-[#d2d2d7] rounded-md text-xs shadow-sm hover:shadow-md transition-shadow duration-200">
                   <SelectValue placeholder="선택" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="원자재">원자재</SelectItem>
                   <SelectItem value="소모품">소모품</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <div>
               <Label className="mb-1 block text-xs">진행 종류</Label>
               <Select value={watch('progress_type')} onValueChange={(value) => setValue('progress_type', value)}>
                 <SelectTrigger className="h-8 bg-white border border-[#d2d2d7] rounded-md text-xs shadow-sm hover:shadow-md transition-shadow duration-200">
                   <SelectValue placeholder="선택" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="일반">일반</SelectItem>
                   <SelectItem value="선진행">선진행</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <div>
               <Label className="mb-1 block text-xs">결제 종류</Label>
               <Select value={watch('payment_category')} onValueChange={(value) => setValue('payment_category', value)}>
                 <SelectTrigger className="h-8 bg-white border border-[#d2d2d7] rounded-md text-xs shadow-sm hover:shadow-md transition-shadow duration-200">
                   <SelectValue placeholder="선택" />
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
           <div className="grid grid-cols-2 gap-2">
             <div>
               <Label className="mb-1 block text-xs">업체명</Label>
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
                 placeholder="업체 선택"
                 isClearable
                 isSearchable
                 closeMenuOnSelect={true}
                 classNamePrefix="vendor-select"
                 styles={{
                   container: base => ({ ...base, width: '100%', fontSize: '12px' }),
                   control: base => ({ ...base, height: 32, minHeight: 32, background: '#fff', border: '1px solid #d2d2d7', borderRadius: 6, fontSize: '12px', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)', '&:hover': { boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' } }),
                   valueContainer: base => ({ ...base, height: 32, padding: '0 8px', fontSize: '12px' }),
                   input: base => ({ ...base, margin: 0, padding: 0, fontSize: '12px' }),
                   indicatorsContainer: base => ({ ...base, height: 32 }),
                   menuPortal: base => ({ ...base, zIndex: 1400 })
                 }}
               />
             </div>
             <div>
               <div className="flex items-center justify-between mb-1">
                 <Label className="text-xs">담당자</Label>
                 <span
                   className="text-primary text-[10px] cursor-pointer hover:underline select-none flex items-center"
                   onClick={openContactsManager}
                 >
                   <span className="-translate-y-px">+</span><span className="ml-1">추가/수정</span>
                 </span>
               </div>
               <div className="shadow-sm hover:shadow-md transition-shadow duration-200">
                 <MultiSelect
                   options={contacts.map(c => ({ value: c.id.toString(), label: c.contact_name || c.contact_email || c.contact_phone || c.position || '' }))}
                   value={watch('contacts')}
                   onChange={val => setValue('contacts', val)}
                   placeholder="담당자 선택"
                 />
               </div>
               {/* 담당자 관리 모달 */}
               <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
                 <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                   <DialogHeader>
                     <DialogTitle>담당자 관리</DialogTitle>
                     <p className="text-sm text-muted-foreground">기존 담당자를 수정하거나 새로운 담당자를 추가하세요</p>
                   </DialogHeader>
                   
                   <div className="space-y-4">
                     {/* 기존 담당자들 (수정 가능) */}
                     {contactsForEdit.filter(c => !c.isNew).length > 0 && (
                       <div>
                         <h4 className="font-medium text-sm mb-3">기존 담당자</h4>
                         <div className="space-y-3">
                           {contactsForEdit.filter(c => !c.isNew).map((contact, index) => (
                             <div key={contact.id || index} className="border rounded-lg p-3 bg-muted/20 hover:shadow-sm transition-shadow duration-200">
                               <div className="grid grid-cols-2 gap-2 mb-2">
                                 <div>
                                   <Label className="text-xs mb-1 block">이름*</Label>
                                   <Input 
                                     value={contact.contact_name} 
                                     onChange={e => handleContactChange(contactsForEdit.indexOf(contact), 'contact_name', e.target.value)}
                                     className="h-8 text-xs hover:shadow-sm focus:shadow-sm transition-shadow duration-200"
                                   />
                                 </div>
                                 <div>
                                   <Label className="text-xs mb-1 block">이메일*</Label>
                                   <Input 
                                     value={contact.contact_email} 
                                     onChange={e => handleContactChange(contactsForEdit.indexOf(contact), 'contact_email', e.target.value)}
                                     className="h-8 text-xs hover:shadow-sm focus:shadow-sm transition-shadow duration-200"
                                   />
                                 </div>
                               </div>
                               <div className="grid grid-cols-2 gap-2">
                                 <div>
                                   <Label className="text-xs mb-1 block">전화</Label>
                                   <Input 
                                     value={contact.contact_phone} 
                                     onChange={e => handleContactChange(contactsForEdit.indexOf(contact), 'contact_phone', e.target.value)}
                                     className="h-8 text-xs hover:shadow-sm focus:shadow-sm transition-shadow duration-200"
                                   />
                                 </div>
                                 <div className="flex items-end gap-2">
                                   <div className="flex-1">
                                     <Label className="text-xs mb-1 block">직급</Label>
                                     <Input 
                                       value={contact.position} 
                                       onChange={e => handleContactChange(contactsForEdit.indexOf(contact), 'position', e.target.value)}
                                       className="h-8 text-xs hover:shadow-sm focus:shadow-sm transition-shadow duration-200"
                                     />
                                   </div>
                                   <Button 
                                     type="button" 
                                     variant="destructive" 
                                     size="sm" 
                                     className="h-8 px-2 hover:shadow-sm transition-shadow duration-200" 
                                     onClick={() => handleDeleteContact(contact.id!)}
                                   >
                                     <Trash2 className="w-3 h-3" />
                                   </Button>
                                 </div>
                               </div>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}

                     {/* 새 담당자 추가 섹션 */}
                     <div>
                       <div className="flex items-center justify-between mb-3">
                         <h4 className="font-medium text-sm">새 담당자 추가</h4>
                         <Button type="button" variant="outline" size="sm" className="hover:shadow-sm transition-shadow duration-200" onClick={addNewContactSlot}>
                           <Plus className="w-3 h-3 mr-1" />
                           추가
                         </Button>
                       </div>
                       <div className="space-y-3">
                         {contactsForEdit.filter(c => c.isNew).map((contact, index) => (
                           <div key={index} className="border rounded-lg p-3 bg-blue-50/50 hover:shadow-sm transition-shadow duration-200">
                             <div className="grid grid-cols-2 gap-2 mb-2">
                               <div>
                                 <Label className="text-xs mb-1 block">이름*</Label>
                                 <Input 
                                   value={contact.contact_name} 
                                   onChange={e => handleContactChange(contactsForEdit.indexOf(contact), 'contact_name', e.target.value)}
                                   className="h-8 text-xs hover:shadow-sm focus:shadow-sm transition-shadow duration-200"
                                   placeholder="담당자 이름"
                                 />
                               </div>
                               <div>
                                 <Label className="text-xs mb-1 block">이메일*</Label>
                                 <Input 
                                   value={contact.contact_email} 
                                   onChange={e => handleContactChange(contactsForEdit.indexOf(contact), 'contact_email', e.target.value)}
                                   className="h-8 text-xs hover:shadow-sm focus:shadow-sm transition-shadow duration-200"
                                   placeholder="이메일 주소"
                                 />
                               </div>
                             </div>
                             <div className="grid grid-cols-2 gap-2">
                               <div>
                                 <Label className="text-xs mb-1 block">전화</Label>
                                 <Input 
                                   value={contact.contact_phone} 
                                   onChange={e => handleContactChange(contactsForEdit.indexOf(contact), 'contact_phone', e.target.value)}
                                   className="h-8 text-xs hover:shadow-sm focus:shadow-sm transition-shadow duration-200"
                                   placeholder="전화번호"
                                 />
                               </div>
                               <div className="flex items-end gap-2">
                                 <div className="flex-1">
                                   <Label className="text-xs mb-1 block">직급</Label>
                                   <Input 
                                     value={contact.position} 
                                     onChange={e => handleContactChange(contactsForEdit.indexOf(contact), 'position', e.target.value)}
                                     className="h-8 text-xs hover:shadow-sm focus:shadow-sm transition-shadow duration-200"
                                     placeholder="직급"
                                   />
                                 </div>
                                 <Button 
                                   type="button" 
                                   variant="ghost" 
                                   size="sm" 
                                   className="h-8 px-2 hover:shadow-sm transition-shadow duration-200" 
                                   onClick={() => removeContactSlot(contactsForEdit.indexOf(contact))}
                                 >
                                   <X className="w-3 h-3" />
                                 </Button>
                               </div>
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   </div>

                   <DialogFooter>
                     <Button onClick={handleSaveAllContacts} disabled={!hasChanges} className="hover:shadow-sm transition-shadow duration-200">
                       모든 변경사항 저장
                     </Button>
                     <DialogClose asChild>
                       <Button variant="outline" className="hover:shadow-sm transition-shadow duration-200">취소</Button>
                     </DialogClose>
                   </DialogFooter>
                 </DialogContent>
               </Dialog>
             </div>
           </div>

           {/* 구매요구자 및 일정 정보 */}
           <div className="grid grid-cols-3 gap-2">
             <div className="flex-1">
               <Label className="mb-1 block text-xs">구매요구자</Label>
               <Controller
                 name="requester_name"
                 control={control}
                 render={({ field }) => (
                   <ReactSelect
                     key={`employee-select-${field.value}`}
                     value={field.value ? 
                       { 
                         value: field.value, 
                         label: field.value
                       } : 
                       null
                     }
                     defaultValue={employeeName ? 
                       { 
                         value: employeeName, 
                         label: employeeName
                       } : 
                       null
                     }
                     onChange={(selectedOption: any) => {
                       const value = (selectedOption as EmployeeOption)?.value || "";
                       field.onChange(value);
                       setEmployeeName(value);
                     }}
                     options={employees.map(employee => ({
                       value: employee.name,
                       label: employee.name
                     }))}
                     placeholder="구매요구자를 검색하거나 선택하세요"
                     isSearchable
                     isClearable={false}
                     noOptionsMessage={() => "일치하는 직원이 없습니다"}
                     filterOption={(option, inputValue) => {
                       const employee = employees.find(emp => emp.name === option.value);
                       const searchText = `${employee?.name || ''} ${employee?.position || ''} ${employee?.email || ''}`.toLowerCase();
                       return searchText.includes(inputValue.toLowerCase());
                     }}
                                            styles={{
                         control: (base) => ({
                           ...base,
                           minHeight: '30px',
                           height: '30px',
                           fontSize: '12px',
                           borderColor: '#d2d2d7',
                           borderRadius: '6px',
                           boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
                           '&:hover': {
                             borderColor: '#d2d2d7',
                             boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                           },
                           '&:focus-within': {
                             borderColor: '#d2d2d7',
                             boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                           }
                         }),
                       valueContainer: (base) => ({
                         ...base,
                         height: '28px',
                         padding: '0 8px',
                         display: 'flex',
                         alignItems: 'center'
                       }),
                       input: (base) => ({
                         ...base,
                         margin: '0px',
                         padding: '0px',
                         height: '28px'
                       }),
                       singleValue: (base) => ({
                         ...base,
                         margin: '0px',
                         lineHeight: '28px'
                       }),
                       placeholder: (base) => ({
                         ...base,
                         margin: '0px',
                         lineHeight: '28px'
                       }),
                       indicatorSeparator: () => ({
                         display: 'none',
                       }),
                       indicatorsContainer: (base) => ({
                         ...base,
                         height: '30px',
                         padding: '0 4px'
                       }),
                       dropdownIndicator: (base) => ({
                         ...base,
                         padding: '4px',
                         '& svg': {
                           width: '16px',
                           height: '16px'
                         }
                       }),
                       clearIndicator: (base) => ({
                         ...base,
                         padding: '4px',
                         '& svg': {
                           width: '16px',
                           height: '16px'
                         }
                       }),
                       menu: (base) => ({
                         ...base,
                         fontSize: '12px',
                         zIndex: 9999
                       }),
                       option: (base, state) => ({
                         ...base,
                         fontSize: '12px',
                         padding: '8px 12px'
                       })
                     }}
                   />
                 )}
               />
             </div>
             <div className="flex-1">
               <Label className="mb-1 block text-xs">청구일</Label>
               <DatePicker 
                 value={watch('request_date') ? new Date(watch('request_date')) : new Date()} 
                 onChange={date => setValue('request_date', date ? date.toISOString().slice(0, 10) : '')} 
                 className="h-[30px] border-[#d2d2d7] bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
               />
             </div>
             <div className="flex-1">
               <Label className="mb-1 block text-xs">입고 요청일</Label>
               <DatePicker 
                 value={watch('delivery_request_date') ? new Date(watch('delivery_request_date')) : new Date()} 
                 onChange={date => setValue('delivery_request_date', date ? date.toISOString().slice(0, 10) : '')} 
                 className="h-[30px] border-[#d2d2d7] bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
               />
             </div>
           </div>



           {/* 프로젝트 정보 */}
           <div className="grid grid-cols-3 gap-2">
             <div className="flex-1">
               <Label className="mb-1 block text-xs">PJ업체</Label>
               <Input 
                 type="text" 
                 value={watch('project_vendor')} 
                 onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue('project_vendor', e.target.value)} 
                 placeholder="입력"
                 className="h-8 w-full bg-white border border-[#d2d2d7] rounded-md text-xs shadow-sm hover:shadow-md focus:shadow-md transition-shadow duration-200"
               />
             </div>
             <div className="flex-1">
               <Label className="mb-1 block text-xs">수주번호</Label>
               <Input 
                 type="text" 
                 value={watch('sales_order_number')} 
                 onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue('sales_order_number', e.target.value)} 
                 placeholder="입력"
                 className="h-8 w-full bg-white border border-[#d2d2d7] rounded-md text-xs shadow-sm hover:shadow-md focus:shadow-md transition-shadow duration-200"
               />
             </div>
             <div className="flex-1">
               <Label className="mb-1 block text-xs">Item</Label>
               <Input 
                 type="text" 
                 value={watch('project_item')} 
                 onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue('project_item', e.target.value)} 
                 placeholder="입력"
                 className="h-8 w-full bg-white border border-[#d2d2d7] rounded-md text-xs shadow-sm hover:shadow-md focus:shadow-md transition-shadow duration-200"
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
              <SelectTrigger className="w-20 h-8 text-xs border-border rounded-md shadow-sm hover:shadow-md transition-shadow duration-200">
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
        <div className="rounded-lg border border-border shadow-sm overflow-hidden">
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
          <div className="bg-primary/5 border border-primary/20 rounded-lg shadow hover:shadow-sm transition-shadow duration-300 p-4">
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
          <Button 
            onClick={handleSubmit} 
            size="sm" 
            className="gap-2 rounded-md px-6 bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-shadow duration-200"
          >
            <Save className="w-3.5 h-3.5" />
            발주 요청
          </Button>
        </div>
      </div>
    </div>
  );
}
