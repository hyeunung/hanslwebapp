"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Save, Calculator, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "../ui/multiselect";
import { DatePicker } from "@/components/ui/datepicker";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useForm as useFormRH, Controller, useFieldArray } from "react-hook-form";
import dynamic from 'next/dynamic';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
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
  // react-table 기반 품목 테이블로 대체

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

  useEffect(() => {
    fields.forEach((item, idx) => {
      const calcAmount = Number(item.quantity) * Number(item.unit_price_value);
      if (item.amount_value !== calcAmount) {
        update(idx, { ...item, amount_value: calcAmount });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.map(f => `${f.quantity}-${f.unit_price_value}`).join(",")]);

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
    <div className="flex gap-6">
       {/* 발주 기본 정보 - 좌측 1/4 폭 */}
       <div className="w-1/4 relative bg-muted/20 border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 p-5 space-y-4">
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
                 <SelectContent position="popper" className="z-[9999]">
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
                 <SelectContent position="popper" className="z-[9999]">
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
              <SelectContent position="popper" className="z-[9999]">
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
               <div className="space-y-2 -mt-px">
                 <Select
                   value={watch('contacts')[0] || ''}
                   onValueChange={val => setValue('contacts', [val])}
                 >
                   <SelectTrigger className="h-[34px] bg-white border border-[#d2d2d7] rounded-md text-xs shadow-sm hover:shadow-md transition-shadow duration-200">
                     <SelectValue placeholder="담당자 선택" />
                   </SelectTrigger>
                   <SelectContent position="popper" className="z-[9999]">
                     {contacts.map(c => (
                       <SelectItem key={c.id} value={c.id.toString()}>
                         {c.contact_name || c.contact_email || c.contact_phone || c.position || ''}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
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
                                     className="w-full h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible-border-0 outline-none text-[11px] bg-white"
                                   />
                                 </div>
                                 <div>
                                   <Label className="text-xs mb-1 block">이메일*</Label>
                                   <Input 
                                     value={contact.contact_email} 
                                     onChange={e => handleContactChange(contactsForEdit.indexOf(contact), 'contact_email', e.target.value)}
                                     className="w-full h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible-border-0 outline-none text-[11px] bg-white"
                                   />
                                 </div>
                               </div>
                               <div className="grid grid-cols-2 gap-2">
                                 <div>
                                   <Label className="text-xs mb-1 block">전화</Label>
                                   <Input 
                                     value={contact.contact_phone} 
                                     onChange={e => handleContactChange(contactsForEdit.indexOf(contact), 'contact_phone', e.target.value)}
                                     className="w-full h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible-border-0 outline-none text-[11px] bg-white"
                                   />
                                 </div>
                                 <div className="flex items-end gap-2">
                                   <div className="flex-1">
                                     <Label className="text-xs mb-1 block">직급</Label>
                                     <Input 
                                       value={contact.position} 
                                       onChange={e => handleContactChange(contactsForEdit.indexOf(contact), 'position', e.target.value)}
                                       className="w-full h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible-border-0 outline-none text-[11px] bg-white"
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
                                   className="w-full h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:border-0 outline-none text-[11px] bg-white"
                                   placeholder="담당자 이름"
                                 />
                               </div>
                               <div>
                                 <Label className="text-xs mb-1 block">이메일*</Label>
                                 <Input 
                                   value={contact.contact_email} 
                                   onChange={e => handleContactChange(contactsForEdit.indexOf(contact), 'contact_email', e.target.value)}
                                   className="w-full h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:border-0 outline-none text-[11px] bg-white"
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
                                   className="w-full h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:border-0 outline-none text-[11px] bg-white"
                                   placeholder="전화번호"
                                 />
                               </div>
                               <div className="flex items-end gap-2">
                                 <div className="flex-1">
                                   <Label className="text-xs mb-1 block">직급</Label>
                                   <Input 
                                     value={contact.position} 
                                     onChange={e => handleContactChange(contactsForEdit.indexOf(contact), 'position', e.target.value)}
                                     className="w-full h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:border-0 outline-none text-[11px] bg-white"
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

       {/* Professional Items Section - 우측 3/4 폭 */}
       <div className="w-3/4 space-y-4">
        <div className="flex items-center mb-2">
          <div className="flex flex-col justify-center">
            <h4 className="font-semibold text-foreground">품목 목록</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Purchase Items</p>
          </div>
          <div className="ml-[15px]">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-20 h-8 text-xs border-border rounded-md shadow-sm hover:shadow-md transition-shadow duration-200 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-md">
                <SelectItem value="KRW">KRW</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* 커스텀 품목 테이블 (디자인/UX 기존과 동일) */}
        <div className="space-y-4 mt-6">
          <div className="rounded-lg border border-border shadow-sm overflow-x-auto">
            <table className="w-full min-w-fit table-fixed">
              <thead>
                <tr className="bg-[#f5f5f7] text-xs text-muted-foreground font-medium">
                  <th className="w-[36px] min-w-[36px] max-w-[36px] text-center px-0 py-3 border-l border-[#e5e7eb]">번호</th>
                  <th className="w-[121px] text-left px-4 py-3 border-l border-[#e5e7eb]">품명</th>
                  <th className="w-[217px] text-left px-4 py-3 border-l border-[#e5e7eb]">규격</th>
                  <th className="w-[36px] min-w-[36px] max-w-[36px] text-center px-0 py-3 border-l border-[#e5e7eb]">수량</th>
                  <th className="w-[89px] text-right px-4 py-3 border-l border-[#e5e7eb]">단가 ({currency})</th>
                  <th className="w-[89px] text-right px-4 py-3 border-l border-[#e5e7eb]">합계 ({currency})</th>
                  <th className="w-[160px] text-left px-4 py-3 border-l border-[#e5e7eb]">비고</th>
                  <th className="w-[36px] min-w-[36px] max-w-[36px] text-center px-0 py-3 border-l border-r border-[#e5e7eb]">삭제</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((item, idx) => (
                  <tr key={idx} className="text-xs bg-background border-b border-border">
                    <td className="w-[36px] min-w-[36px] max-w-[36px] text-center px-0 border-l border-[#e5e7eb] align-middle">{idx + 1}</td>
                    <td className="w-[121px] p-0 align-middle border-l border-[#e5e7eb] break-words whitespace-normal">
                      <Input
                        value={item.item_name}
                        onChange={e => update(idx, { ...item, item_name: e.target.value })}
                        placeholder="품명"
                        className="w-full h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible-border-0 outline-none text-xs bg-white"
                      />
                    </td>
                    <td className="w-[217px] p-0 align-middle border-l border-[#e5e7eb] break-words whitespace-normal">
                      <Input
                        value={item.specification}
                        onChange={e => update(idx, { ...item, specification: e.target.value })}
                        placeholder="규격"
                        className="w-full h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible-border-0 outline-none text-xs bg-white"
                      />
                    </td>
                    <td className="w-[36px] min-w-[36px] max-w-[36px] text-center px-0 border-l border-[#e5e7eb] text-center">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={item.quantity}
                        onChange={e => update(idx, { ...item, quantity: Number(e.target.value) })}
                        className="w-full h-8 px-2 border-0 shadow-none bg-transparent text-center rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:border-0 outline-none text-xs bg-white"
                      />
                    </td>
                    <td className="w-[89px] text-right px-4 border-l border-[#e5e7eb] text-black break-words whitespace-normal">
                      <div className="flex items-center justify-end w-full">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={item.unit_price_value ? Number(item.unit_price_value).toLocaleString() : ""}
                          onChange={e => {
                            const raw = e.target.value.replace(/,/g, "");
                            update(idx, { ...item, unit_price_value: Number(raw) });
                          }}
                          className="w-full h-8 px-2 border-0 shadow-none bg-transparent text-right rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:border-0 outline-none text-xs bg-white overflow-x-hidden"
                          placeholder="단가"
                        />
                        <span className="ml-1 text-xs text-muted-foreground">{currency === "KRW" ? "₩" : "$"}</span>
                      </div>
                    </td>
                    <td className="w-[89px] text-right px-4 border-l border-[#e5e7eb] text-black break-words whitespace-normal">
                      <span>
                        {item.amount_value ? Number(item.amount_value).toLocaleString() : "0"}
                        <span className="ml-1 text-xs text-muted-foreground">{currency === "KRW" ? "₩" : "$"}</span>
                      </span>
                    </td>
                    <td className="w-[160px] p-0 align-middle border-l border-[#e5e7eb] break-words whitespace-normal">
                      <Input
                        value={item.remark}
                        onChange={e => update(idx, { ...item, remark: e.target.value })}
                        placeholder="비고(용도)"
                        className="w-full h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible-border-0 outline-none text-xs bg-white"
                      />
                    </td>
                    <td className="w-[36px] min-w-[36px] max-w-[36px] text-center px-0 border-l border-r border-[#e5e7eb] align-middle">
                      <Button size="sm" variant="outline" className="h-7 min-w-[40px] px-3 p-0 text-red-500 border-red-200 hover:bg-red-50" onClick={() => remove(idx)}>
                        삭제
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#f5f5f7] text-xs font-medium" style={{ borderTop: '4px solid #f5f5f7', borderBottom: '4px solid #f5f5f7' }}>
                  <td className="w-[36px] min-w-[36px] max-w-[36px] text-center px-0 font-semibold border-l border-[#e5e7eb]">총 합계</td>
                  <td className="px-4 border-l border-[#e5e7eb]" colSpan={4}></td>
                  <td className="text-right px-4 font-semibold border-l border-[#e5e7eb] text-foreground">{totalAmount ? totalAmount.toLocaleString() : ''}</td>
                  <td className="px-4 border-l border-r border-[#e5e7eb]" colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <Separator className="my-4" />
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={addCount}
                onChange={e => setAddCount(Math.max(1, Number(e.target.value.replace(/[^0-9]/g, ''))))}
                className="w-16 h-8 text-xs shadow-md hover:shadow-lg border border-[#d2d2d7] bg-white"
              />
              <Button size="sm" variant="ghost" onClick={() => append({ line_number: fields.length + 1, item_name: '', specification: '', quantity: 1, unit_price_value: 0, unit_price_currency: currency, amount_value: 0, amount_currency: currency, remark: '' })} className="px-4 text-blue-600 font-semibold bg-transparent border-none shadow-none hover:text-blue-700 hover:bg-transparent hover:shadow-none hover:border-none text-xs ml-[-10px]">+ 품목추가</Button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="bg-white text-red-500 border-red-200 hover:bg-red-50" onClick={() => { fields.forEach((_, idx) => remove(fields.length - idx - 1)); append({ line_number: 1, item_name: '', specification: '', quantity: 1, unit_price_value: 0, unit_price_currency: currency, amount_value: 0, amount_currency: currency, remark: '' }); }}>전체삭제</Button>
              <Button size="sm" onClick={handleSubmit}>발주 요청</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
