"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Save, Calculator, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  link?: string;
}

interface FormValues {
  vendor_id: number;
  contact_id?: number;
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

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [employeeName, setEmployeeName] = useState<string>("");
  const [employees, setEmployees] = useState<{id: string; name: string; email?: string; phone?: string; adress?: string; position?: string; department?: string;}[]>([]);
  
  useEffect(() => {
    // DB에서 직원 목록 가져오기
    const loadEmployees = async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, email, phone, adress, position, department');
      if (data && !error && data.length > 0) {
        setEmployees(data.map(dbEmp => ({
          id: dbEmp.id,
          name: dbEmp.name,
          email: dbEmp.email,
          phone: dbEmp.phone,
          adress: dbEmp.adress,
          position: dbEmp.position,
          department: dbEmp.department
        })));
      } else if (user?.email) {
        // DB에서 못 불러오면 로그인 사용자 이름만 employees에 추가
        const fallbackName = user.email?.split('@')[0] || "사용자";
        setEmployees([{ id: '', name: fallbackName, email: user.email }]);
      } else {
        setEmployees([]);
      }
    };
    loadEmployees();

    // 현재 로그인한 사용자의 이름을 기본값으로 설정
    if (user?.email) {
      supabase
        .from('employees')
        .select('name')
        .eq('email', user.email)
        .single()
        .then(({ data, error }) => {
          if (data && !error) {
            setEmployeeName(data.name);
            if (setValue) setValue('requester_name', data.name);
          } else {
            const fallbackName = user.email?.split('@')[0] || "사용자";
            setEmployeeName(fallbackName);
            if (setValue) setValue('requester_name', fallbackName);
          }
        });
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
  const [addCount, setAddCount] = useState(1);
  const [inputValues, setInputValues] = useState<{[key: string]: string}>({});
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [contactsForEdit, setContactsForEdit] = useState<{ id?: number; contact_name: string; contact_email: string; contact_phone: string; position: string; isNew?: boolean }[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  // 중복 제출 방지용 ref
  const isSubmittingRef = useRef(false);

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
          link: "",
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

  // 필수 항목 체크 함수
  const checkRequiredFields = () => {
    const requestType = watch('request_type');
    const progressType = watch('progress_type');
    const paymentCategory = watch('payment_category');
    
    return !!(requestType && progressType && paymentCategory && vendor && vendor !== "0" && fields.length > 0);
  };

  // 실시간 필수항목 체크를 위한 state
  const [isFormValid, setIsFormValid] = useState(false);

  // 필수항목 변경 감지
  useEffect(() => {
    setIsFormValid(checkRequiredFields());
  }, [watch('request_type'), watch('progress_type'), watch('payment_category'), vendor, fields.length, checkRequiredFields]);

  // 발주번호 생성 함수 (재시도 로직 포함)
  const generatePurchaseOrderNumber = async () => {
    const today = new Date();
    // 한국 시간대(UTC+9) 기준으로 날짜 생성
    const koreaTime = new Date(today.getTime() + (9 * 60 * 60 * 1000));
    const dateStr = koreaTime.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const prefix = `F${dateStr}_`;
    
    // 오늘 날짜로 시작하는 발주번호들 조회 (유효한 숫자 형식만)
    const { data: existingOrders, error: queryError } = await supabase
      .from('purchase_requests')
      .select('purchase_order_number')
      .like('purchase_order_number', `${prefix}%`)
      .order('purchase_order_number', { ascending: false });
    
    if (queryError) {
    }
    
    // 다음 순번 계산 (숫자인 시퀀스만 찾기)
    let nextNumber = 1;
    let maxSequence = 0;
    
    if (existingOrders && existingOrders.length > 0) {
      // 모든 발주번호를 확인하여 가장 큰 유효한 숫자 시퀀스 찾기
      for (const order of existingOrders) {
        const orderNumber = order.purchase_order_number;
        
        // 발주번호 형식: F20250612_001
        const parts = orderNumber.split('_');
        if (parts.length >= 2) {
          const sequenceStr = parts[1];
          const sequence = parseInt(sequenceStr, 10);
          
          // 유효한 숫자이고 현재 최대값보다 크면 업데이트
          if (!isNaN(sequence) && sequence > maxSequence) {
            maxSequence = sequence;
          }
        }
      }
      
      nextNumber = maxSequence + 1;
    }
    
    // 3자리 패딩으로 발주번호 생성
    const safeNextNumber = isNaN(nextNumber) ? 1 : nextNumber;
    const purchaseOrderNumber = `${prefix}${String(safeNextNumber).padStart(3, '0')}`;
    
    return purchaseOrderNumber;
  };

  const handleSubmit = async (data: FormValues) => {
    const currentEmployee = employees.find(emp => emp.name === data.requester_name);
    
    if (!user) {
      setError("로그인이 필요합니다.");
      return;
    }
    
    // 필수 항목이 모두 채워져 있는지 재확인
    if (!checkRequiredFields()) {
      return; // 버튼이 비활성화되어 있어야 하므로 별도 오류 메시지 없이 그냥 리턴
    }
    setLoading(true);
    setError("");
    
    try {
      // 구매요청자 이름에 맞는 직원 정보 찾기
      if (!currentEmployee) {
        setError("구매요청자 이름에 해당하는 직원이 없습니다. 이름을 정확히 입력해 주세요.");
        setLoading(false);
        return;
      }
      
      // 발주번호 중복 에러 시 재시도 로직
      let purchaseOrderNumber: string = "";
      let prId: number = 0;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          // 발주번호 자동 생성
          purchaseOrderNumber = await generatePurchaseOrderNumber();

      
          // 구매 요청 등록 시도
          const { data: pr, error: prError } = await supabase.from("purchase_requests").insert({
            requester_id: currentEmployee.id,
            purchase_order_number: purchaseOrderNumber,
            requester_name: data.requester_name,
            requester_email: currentEmployee?.email || user.email,
            requester_phone: currentEmployee?.phone,
            requester_fax: null, // fax는 현재 employees 테이블에 없으므로 null
            requester_address: currentEmployee?.adress,
            vendor_id: Number(vendor),
            sales_order_number: data.sales_order_number,
            project_vendor: data.project_vendor,
            project_item: data.project_item,
            request_date: data.request_date,
            delivery_request_date: data.delivery_request_date || null,
            request_type: data.request_type,
            progress_type: data.progress_type,
            is_payment_completed: false,
            payment_category: data.payment_category,
            currency,
            total_amount: fields.reduce((sum, i) => sum + i.amount_value, 0),
            unit_price_currency: fields[0]?.unit_price_currency || currency,
            po_template_type: data.po_template_type,
            contact_id: data.contact_id ? Number(data.contact_id) : null,
          }).select("id").single();
          
          // 발주번호 중복 에러가 아닌 다른 에러는 바로 throw
          if (prError && !prError.message.includes('duplicate key value violates unique constraint')) {
            throw prError;
          }
          
          // 발주번호 중복 에러인 경우
          if (prError && prError.message.includes('duplicate key value violates unique constraint')) {
            retryCount++;
            if (retryCount >= maxRetries) {
              throw new Error(`발주번호 생성에 ${maxRetries}번 실패했습니다. 잠시 후 다시 시도해주세요.`);
            }
            // 재시도를 위해 짧은 대기
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
            continue;
          }
          
          // 성공한 경우
          if (!pr) throw new Error("등록 실패");
          prId = pr.id;
          break; // 성공 시 루프 종료
          
        } catch (retryError: any) {
          // 발주번호 중복이 아닌 에러는 바로 throw
          if (!retryError.message.includes('duplicate key value violates unique constraint')) {
            throw retryError;
          }
          
          retryCount++;
          if (retryCount >= maxRetries) {
            throw new Error(`발주번호 생성에 ${maxRetries}번 실패했습니다. 잠시 후 다시 시도해주세요.`);
          }
          
          // 재시도를 위해 짧은 대기 (100-300ms 랜덤)
          await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        }
      }
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
          link: item.link || null,
        });
        if (itemErr) throw itemErr;
      }
      
      // 발주 요청 성공 처리
      
      // 📨 중간관리자 DM 알림 발송 (품목 추가 완료 후 정확한 개수로)
      try {
        const notifyResponse = await fetch(`/api/purchase/${prId}/notify-middle-manager`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (notifyResponse.ok) {
          const notifyResult = await notifyResponse.json();
        } else {
          const errorText = await notifyResponse.text();
        }
      } catch (notifyError) {
      }
      
      // 1. 폼 초기화
      reset({
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
        requester_name: employeeName, // 요청자 이름은 유지
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
            link: "",
          },
        ],
        request_date: new Date().toISOString().slice(0, 10),
      });
      
      // 2. 상태 초기화
      setVendor("");
      setSelectedContacts([]);
      setCurrency("KRW");
      setError("");
      setLoading(false);
      
      // 3. 성공 메시지 표시 (선택적)
      
      // 4. 발주 목록으로 이동
      try {
        await router.push('/purchase/list');
      } catch (routerError) {
        // 대체 라우팅 방법
        window.location.href = '/purchase/list';
      }
      return;
    } catch (err: any) {
      setError(err.message || "오류가 발생했습니다.");
    } finally {
      // 오류가 있었을 때만 실행됨 (성공 시에는 return으로 빠짐)
      setLoading(false);
      isSubmittingRef.current = false;
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

    // @hansl.com 도메인 이메일 검증
    const hasHanslEmail = contactsForEdit.some(contact => 
      contact.contact_email && contact.contact_email.includes('@hansl.com')
    );
    if (hasHanslEmail) {
      alert('한슬 직원 이메일은 업체 담당자로 등록할 수 없습니다.');
      return;
    }

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
    }
  };

  const paymentCategory = watch('payment_category');

  return (
    <form 
      onSubmit={(e) => {
        e.preventDefault();
        rhHandleSubmit(handleSubmit)(e);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.keyCode === 13) {
          e.preventDefault();
        }
      }}
    >
      <div className="flex gap-6">
       {/* 발주 기본 정보 - 좌측 1/4 폭 */}
       <div className="w-1/4 relative bg-muted/20 border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 p-5 space-y-4">
         <div className="flex flex-row items-start justify-between w-full mb-4">
           <div className="flex flex-col">
             <h4 className="font-semibold text-foreground">발주 기본 정보</h4>
             <p className="text-xs text-muted-foreground mt-0.5">Basic Information</p>
           </div>
           <div className="flex flex-col items-start">
             <Label className="mb-1 block text-xs">발주서 종류<span className="text-red-500 ml-1">*</span></Label>
             <Select value={watch('po_template_type')} onValueChange={value => setValue('po_template_type', value)}>
               <SelectTrigger className="h-8 w-28 bg-white border border-[#d2d2d7] rounded-md text-xs shadow-sm hover:shadow-md transition-shadow duration-200">
                 <SelectValue placeholder="종류 선택" />
               </SelectTrigger>
               <SelectContent position="popper" className="z-[9999]">
                 <SelectItem value="일반">일반</SelectItem>
                 <SelectItem value="PCB">PCB</SelectItem>
                 <SelectItem value="소모품">소모품</SelectItem>
                 <SelectItem value="기타">기타</SelectItem>
               </SelectContent>
             </Select>
           </div>
         </div>
         {watch('po_template_type') === '일반' && (
           <div className="space-y-4">
             {/* 요청 설정 */}
             <div className="grid grid-cols-3 gap-2">
               <div>
                 <Label className="mb-1 block text-xs">요청 유형<span className="text-red-500 ml-1">*</span></Label>
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
                 <Label className="mb-1 block text-xs">진행 종류<span className="text-red-500 ml-1">*</span></Label>
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
                 <Label className="mb-1 block text-xs">결제 종류<span className="text-red-500 ml-1">*</span></Label>
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
                 <Label className="mb-1 block text-xs">업체명<span className="text-red-500 ml-1">*</span></Label>
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
                   closeMenuOnSelect={false}
                   classNamePrefix="vendor-select"
                  blurInputOnSelect={false}
                  openMenuOnFocus={false}
                  openMenuOnClick={true}
                  tabSelectsValue={false}
                  captureMenuScroll={false}
                  pageSize={20}
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
                   <Label className="text-xs">업체 담당자</Label>
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
                     onValueChange={val => {
                       setValue('contacts', [val]);
                       setValue('contact_id', val ? Number(val) : undefined);
                     }}
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
                                       className="w-full h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible-border-0 outline-none text-[11px] bg-white purchase-item-input-quantity"
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const nextIdx = index + 1;
                                const inputs = document.querySelectorAll('.purchase-item-input-quantity');
                                if (nextIdx < fields.length) {
                                  (inputs[nextIdx] as HTMLInputElement)?.focus();
                                } else {
                                  append({
                                    line_number: fields.length + 1,
                                    item_name: '',
                                    specification: '',
                                    quantity: 1,
                                    unit_price_value: 0,
                                    unit_price_currency: currency,
                                    amount_value: 0,
                                    amount_currency: currency,
                                    remark: '',
                                    link: ''
                                  });
                                  setTimeout(() => {
                                    const newInputs = document.querySelectorAll('.purchase-item-input-quantity');
                                    (newInputs[nextIdx] as HTMLInputElement)?.focus();
                                  }, 10);
                                }
                              }
                            }}
                                   />
                                   </div>
                                   <div>
                                     <Label className="text-xs mb-1 block">이메일*</Label>
                                     <Input 
                                       value={contact.contact_email} 
                                       onChange={e => handleContactChange(contactsForEdit.indexOf(contact), 'contact_email', e.target.value)}
                                       className="w-full h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible-border-0 outline-none text-[11px] bg-white"
                                       placeholder="예: contact@supplier.co.kr"
                                     />
                                     {contact.contact_email?.includes('@hansl.com') && (
                                       <div className="text-red-500 text-xs mt-1">⚠️ 한슬 직원 이메일은 업체 담당자로 등록할 수 없습니다</div>
                                     )}
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
                                 placeholder="예: contact@supplier.co.kr"
                                 />
                                   {contact.contact_email?.includes('@hansl.com') && (
                                       <div className="text-red-500 text-xs mt-1">⚠️ 한슬 직원 이메일은 업체 담당자로 등록할 수 없습니다</div>
                                     )}
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
                       <Button type="button" onClick={handleSaveAllContacts} disabled={!hasChanges} className="hover:shadow-sm transition-shadow duration-200">
                         모든 변경사항 저장
                       </Button>
                       <DialogClose asChild>
                         <Button type="button" variant="outline" className="hover:shadow-sm transition-shadow duration-200">취소</Button>
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
                 selected={watch('request_date') ? new Date(watch('request_date')) : new Date()} 
                 onChange={date => setValue('request_date', date ? date.toISOString().slice(0, 10) : '')} 
                 className="h-[30px] border-[#d2d2d7] bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
               />
             </div>
             <div className="flex-1">
               <Label className="mb-1 block text-xs">입고 요청일</Label>
               <DatePicker 
                 selected={watch('delivery_request_date') ? new Date(watch('delivery_request_date')) : undefined} 
                 onChange={date => setValue('delivery_request_date', date ? date.toISOString().slice(0, 10) : '')} 
                 className="h-[30px] border-[#d2d2d7] bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
                 placeholder="선택하세요"
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
      )}
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
                  {paymentCategory === '구매 요청' && (
                    <th className="w-[200px] text-left px-4 py-3 border-l border-[#e5e7eb]">링크</th>
                  )}
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
                        className="w-full h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible-border-0 outline-none text-xs bg-white purchase-item-input-item_name"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const nextIdx = idx + 1;
                            const inputs = document.querySelectorAll('.purchase-item-input-item_name');
                            if (nextIdx < fields.length) {
                              (inputs[nextIdx] as HTMLInputElement)?.focus();
                            } else {
                              append({
                                line_number: fields.length + 1,
                                item_name: '',
                                specification: '',
                                quantity: 1,
                                unit_price_value: 0,
                                unit_price_currency: currency,
                                amount_value: 0,
                                amount_currency: currency,
                                remark: '',
                                link: ''
                              });
                              setTimeout(() => {
                                const newInputs = document.querySelectorAll('.purchase-item-input-item_name');
                                (newInputs[nextIdx] as HTMLInputElement)?.focus();
                              }, 10);
                            }
                          }
                        }}
                      />
                    </td>
                    <td className="w-[217px] p-0 align-middle border-l border-[#e5e7eb] break-words whitespace-normal">
                      <Input
                        value={item.specification}
                        onChange={e => update(idx, { ...item, specification: e.target.value })}
                        placeholder="규격"
                        className="w-full h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible-border-0 outline-none text-xs bg-white purchase-item-input-specification"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const nextIdx = idx + 1;
                            const inputs = document.querySelectorAll('.purchase-item-input-specification');
                            if (nextIdx < fields.length) {
                              (inputs[nextIdx] as HTMLInputElement)?.focus();
                            } else {
                              append({
                                line_number: fields.length + 1,
                                item_name: '',
                                specification: '',
                                quantity: 1,
                                unit_price_value: 0,
                                unit_price_currency: currency,
                                amount_value: 0,
                                amount_currency: currency,
                                remark: '',
                                link: ''
                              });
                              setTimeout(() => {
                                const newInputs = document.querySelectorAll('.purchase-item-input-specification');
                                (newInputs[nextIdx] as HTMLInputElement)?.focus();
                              }, 10);
                            }
                          }
                        }}
                      />
                    </td>
                    <td className="w-[36px] min-w-[36px] max-w-[36px] text-center px-0 border-l border-[#e5e7eb] text-center">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={isNaN(item.quantity) ? '' : item.quantity.toString()}
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          update(idx, { ...item, quantity: val ? Number(val) : 1 });
                        }}
                        className="w-full h-8 px-2 border-0 shadow-none bg-transparent text-center rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible-border-0 outline-none text-xs bg-white purchase-item-input-quantity"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const nextIdx = idx + 1;
                            const inputs = document.querySelectorAll('.purchase-item-input-quantity');
                            if (nextIdx < fields.length) {
                              (inputs[nextIdx] as HTMLInputElement)?.focus();
                            } else {
                              append({
                                line_number: fields.length + 1,
                                item_name: '',
                                specification: '',
                                quantity: 1,
                                unit_price_value: 0,
                                unit_price_currency: currency,
                                amount_value: 0,
                                amount_currency: currency,
                                remark: '',
                                link: ''
                              });
                              setTimeout(() => {
                                const newInputs = document.querySelectorAll('.purchase-item-input-quantity');
                                (newInputs[nextIdx] as HTMLInputElement)?.focus();
                              }, 10);
                            }
                          }
                        }}
                      />
                    </td>
                    <td className="w-[89px] text-right px-4 border-l border-[#e5e7eb] text-black break-words whitespace-normal">
                      <div className="flex items-center justify-end w-full">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={inputValues[`${idx}_unit_price_value`] ?? (item.unit_price_value === 0 ? "" : item.unit_price_value?.toString() || "")}
                          onChange={e => {
                            const raw = e.target.value.replace(/,/g, "");
                            // 숫자와 소수점만 허용
                            const cleanValue = raw.replace(/[^0-9.]/g, '');
                            // 소수점 중복 방지
                            const parts = cleanValue.split('.');
                            const finalValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleanValue;
                            
                            // 입력 중인 값 저장 (소수점 유지)
                            setInputValues(prev => ({...prev, [`${idx}_unit_price_value`]: finalValue}));
                            
                            // 계산용 숫자 값 저장
                            const numVal = finalValue === '' ? 0 : parseFloat(finalValue) || 0;
                            update(idx, { ...item, unit_price_value: numVal });
                          }}
                          onBlur={() => {
                            // 포커스 벗어날 때 입력값 정리
                            setInputValues(prev => {
                              const newState = {...prev};
                              delete newState[`${idx}_unit_price_value`];
                              return newState;
                            });
                          }}
                          className="w-full h-8 px-2 border-0 shadow-none bg-transparent text-right rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible-border-0 outline-none text-xs bg-white overflow-x-hidden purchase-item-input-unit_price_value"
                          placeholder="단가"
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const nextIdx = idx + 1;
                              const inputs = document.querySelectorAll('.purchase-item-input-unit_price_value');
                              if (nextIdx < fields.length) {
                                (inputs[nextIdx] as HTMLInputElement)?.focus();
                              } else {
                                append({
                                  line_number: fields.length + 1,
                                  item_name: '',
                                  specification: '',
                                  quantity: 1,
                                  unit_price_value: 0,
                                  unit_price_currency: currency,
                                  amount_value: 0,
                                  amount_currency: currency,
                                  remark: '',
                                  link: ''
                                });
                                setTimeout(() => {
                                  const newInputs = document.querySelectorAll('.purchase-item-input-unit_price_value');
                                  (newInputs[nextIdx] as HTMLInputElement)?.focus();
                                }, 10);
                              }
                            }
                          }}
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
                        className="w-full h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible-border-0 outline-none text-xs bg-white purchase-item-input-remark"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const nextIdx = idx + 1;
                            const inputs = document.querySelectorAll('.purchase-item-input-remark');
                            if (nextIdx < fields.length) {
                              (inputs[nextIdx] as HTMLInputElement)?.focus();
                            } else {
                              append({
                                line_number: fields.length + 1,
                                item_name: '',
                                specification: '',
                                quantity: 1,
                                unit_price_value: 0,
                                unit_price_currency: currency,
                                amount_value: 0,
                                amount_currency: currency,
                                remark: '',
                                link: ''
                              });
                              setTimeout(() => {
                                const newInputs = document.querySelectorAll('.purchase-item-input-remark');
                                (newInputs[nextIdx] as HTMLInputElement)?.focus();
                              }, 10);
                            }
                          }
                        }}
                      />
                    </td>
                    {paymentCategory === '구매 요청' && (
                      <td className="w-[200px] p-0 align-middle border-l border-[#e5e7eb] break-words whitespace-normal">
                        <Input
                          value={item.link || ''}
                          onChange={e => update(idx, { ...item, link: e.target.value })}
                          placeholder="구매 링크 URL"
                          className="w-full h-8 px-2 border-0 shadow-none bg-transparent rounded-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible-border-0 outline-none text-xs bg-white purchase-item-input-link"
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const nextIdx = idx + 1;
                              const inputs = document.querySelectorAll('.purchase-item-input-link');
                              if (nextIdx < fields.length) {
                                (inputs[nextIdx] as HTMLInputElement)?.focus();
                              } else {
                                append({
                                  line_number: fields.length + 1,
                                  item_name: '',
                                  specification: '',
                                  quantity: 1,
                                  unit_price_value: 0,
                                  unit_price_currency: currency,
                                  amount_value: 0,
                                  amount_currency: currency,
                                  remark: '',
                                  link: ''
                                });
                                setTimeout(() => {
                                  const newInputs = document.querySelectorAll('.purchase-item-input-item_name');
                                  (newInputs[nextIdx] as HTMLInputElement)?.focus();
                                }, 10);
                              }
                            }
                          }}
                        />
                      </td>
                    )}
                    <td className="w-[36px] min-w-[36px] max-w-[36px] text-center px-0 border-l border-r border-[#e5e7eb] align-middle">
                      <Button type="button" size="sm" variant="outline" className="h-7 min-w-[40px] px-3 p-0 text-red-500 border-red-200 hover:bg-red-50" onClick={() => remove(idx)}>
                        삭제
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#f5f5f7] text-xs font-medium" style={{ borderTop: '4px solid #f5f5f7', borderBottom: '4px solid #f5f5f7' }}>
                  <td className="w-[36px] min-w-[36px] max-w-[36px] text-center px-0 font-semibold border-l border-[#e5e7eb]">총 합계</td>
                  <td className="px-4 border-l border-[#e5e7eb]" colSpan={5}></td>
                  <td className="text-right px-4 font-semibold border-l border-[#e5e7eb] text-foreground">{totalAmount ? totalAmount.toLocaleString() : ''}</td>
                  <td className="px-4 border-l border-r border-[#e5e7eb]" colSpan={paymentCategory === '구매 요청' ? 2 : 1}></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <Separator className="my-4" />
          {/* Error and Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={addCount}
                onChange={e => setAddCount(Math.max(1, Number(e.target.value.replace(/[^0-9]/g, ''))))}
                className="w-16 h-8 text-xs shadow-md hover:shadow-lg border border-[#d2d2d7] bg-white"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  for (let i = 0; i < addCount; i++) {
                    append({
                      line_number: fields.length + 1 + i,
                      item_name: '',
                      specification: '',
                      quantity: 1,
                      unit_price_value: 0,
                      unit_price_currency: currency,
                      amount_value: 0,
                      amount_currency: currency,
                      remark: '',
                      link: ''
                    });
                  }
                }}
                className="px-4 text-blue-600 font-semibold bg-transparent border-none shadow-none hover:text-blue-700 hover:bg-transparent hover:shadow-none hover:border-none text-xs ml-[-10px]"
              >
                + 품목추가
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" className="bg-white text-red-500 border-red-200 hover:bg-red-50" onClick={() => { fields.forEach((_idx, index) => remove(fields.length - 1 - index)); append({ line_number: 1, item_name: '', specification: '', quantity: 1, unit_price_value: 0, unit_price_currency: currency, amount_value: 0, amount_currency: currency, remark: '', link: '' }); }}>전체삭제</Button>
              <Button 
                type="submit" 
                size="sm" 
                disabled={loading || !isFormValid}
                onClick={(e) => {
                  // form submit이 자동으로 처리됨
                }}
                className={`${!isFormValid && !loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? "처리 중..." : "발주 요청"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </form>
  );
}
