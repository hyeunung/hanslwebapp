"use client";
import { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

import { Search, Filter, MoreHorizontal, ChevronDown, ChevronRight, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import EmailButton from "@/components/purchase/EmailButton";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";
import { usePurchaseData } from "@/hooks/usePurchaseData";
import { usePurchaseFilters } from "@/hooks/usePurchaseFilters";
import PurchaseTable from "@/components/purchase/PurchaseTable";
import { DatePicker } from "@/components/ui/datepicker";
import { format } from "date-fns";
import { useAuth } from "@/app/providers/AuthProvider";
import { generatePurchaseOrderExcelJS, PurchaseOrderData } from "@/utils/exceljs/generatePurchaseOrderExcel";

// 발주(구매) 데이터의 타입(구성요소) 정의입니다. 실제로 코드를 수정할 일이 없다면, 그냥 참고만 하셔도 됩니다.
interface Purchase {
  id: number;
  purchase_order_number?: string;
  request_date: string;
  delivery_request_date: string;
  progress_type: string;
  is_payment_completed: boolean; // <-- 한 줄만 남기고 아래 중복 선언 삭제
  payment_category: string;
  currency: string;
  request_type: string;
  vendor_name: string;
  vendor_payment_schedule: string;
  requester_name: string;
  item_name: string;
  specification: string;
  quantity: number;
  unit_price_value: number;
  amount_value: number;
  remark: string;
  project_vendor: string;
  sales_order_number: string;
  project_item: string;
  line_number: number;
  contact_name?: string;
  middle_manager_status?: string;
  final_manager_status?: string;
  payment_completed_at: string;
  is_received: boolean;
  received_at: string;
  final_manager_approved_at?: string | null;
  link?: string;
}

interface Employee {
  name: string;
  email: string;
  purchase_role?: string[];
}

interface User {
  email: string;
  name: string;
  roles: string[];
  purchase_role?: string[];
}

interface PurchaseListMainProps {
  onEmailToggle?: () => void;
  showEmailButton?: boolean;
}

// 화면 상단의 탭(진행상태별) 목록입니다. 예: 승인대기, 구매현황, 입고현황, 전체항목
const NAV_TABS: { key: string; label: string }[] = [
  { key: 'pending', label: '승인대기' },
  { key: 'purchase', label: '구매 현황' },
  { key: 'receipt', label: '입고 현황' },
  { key: 'done', label: '전체 항목' },
];

// 이 함수가 실제로 '발주 목록' 화면 전체를 만듭니다.
export default function PurchaseListMain({ onEmailToggle, showEmailButton = true }: PurchaseListMainProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  // 검색어, 직원 선택, 탭(진행상태) 등 화면의 상태를 관리합니다.
  const [searchTerm, setSearchTerm] = useState(""); // 검색창에 입력한 내용
  const [selectedEmployee, setSelectedEmployee] = useState<string>(''); // 선택된 직원. 탭 변경 시 각각 기본값으로 재설정
  const initialTab = searchParams.get('subtab') || 'pending';
  const [activeTab, setActiveTab] = useState(initialTab); // 현재 선택된 탭(진행상태)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set()); // 펼쳐진 주문서 그룹(여러 줄짜리)
  const lastTabRef = useRef<HTMLButtonElement>(null); // 탭 UI 위치 계산용
  const [sepLeft, setSepLeft] = useState(0); // 탭 구분선 위치
  const [pressedOrder, setPressedOrder] = useState<string | null>(null); // 클릭된 주문서(행) 기억
  const [filters, setFilters] = useState<Record<string, string>>({
    pending: '',
    purchase: '',
    receipt: '',
    done: 'all',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 13;

  // 기간 필터 상태
  const { user } = useAuth();
  const thisYear = new Date().getFullYear();
  const defaultStart = new Date(thisYear, 0, 1);
  const defaultEnd = new Date();
  const [period, setPeriod] = useState<[Date | null, Date | null]>([defaultStart, defaultEnd]);
  const [dateModalOpen, setDateModalOpen] = useState(false);

  // 사용자별 저장된 기간 불러오기
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('user_preferences')
        .select('period_start, period_end')
        .eq('user_id', user.id)
        .single();
      if (data) {
        const ps = data.period_start ? new Date(data.period_start) : defaultStart;
        const pe = data.period_end ? new Date(data.period_end) : defaultEnd;
        setPeriod([ps, pe]);
      }
    })();
  }, [user?.id]);

  // 기간 변경 시 즉시 저장 (사용자별)
  useEffect(() => {
    if (!user) return;
    if (!period[0] || !period[1]) return;
    (async () => {
      await supabase.from('user_preferences').upsert({
        user_id: user.id,
        period_start: period[0]?.toISOString().slice(0, 10),
        period_end: period[1]?.toISOString().slice(0, 10),
      });
    })();
  }, [period, user?.id]);

  // 실제 데이터(발주 목록, 직원 목록 등)는 아래 커스텀 훅에서 불러옵니다.
  // usePurchaseData: 서버에서 데이터 불러오기, 현재 로그인 사용자 정보 등 관리
  const {
    purchases,
    employees,
    currentUserName,
    currentUserRoles,
    isLoadingEmployees,
    isLoadingPurchases,
    loadMyRequests,
    loadEmployees,
  } = usePurchaseData();

  // purchase_manager나 app_admin 권한이 있는 사용자는 모든 요청을 볼 수 있습니다.
  const visiblePurchases = useMemo(() => {
    if (currentUserRoles && (currentUserRoles.includes('purchase_manager') || currentUserRoles.includes('app_admin'))) {
      return purchases;
    }
    return purchases.filter(p => p.requester_name !== '정현웅' && p.requester_name !== '정희웅');
  }, [purchases, currentUserRoles]);

  const roleCase = useMemo(() => {
    if (!currentUserRoles || currentUserRoles.length === 0) return 1; // null
    if (currentUserRoles.includes('purchase_manager')) return 2;
    if (currentUserRoles.some(r => ['middle_manager', 'final_approver', 'app_admin', 'ceo'].includes(r))) return 3;
    return 1;
  }, [currentUserRoles]);

  // 탭별 기본 직원 필터 계산
  const computeDefaultEmployee = useCallback(
    (tabKey: string): string => {
      if (!currentUserName) return 'all';
      switch (roleCase) {
        case 1: // role null
          if (tabKey === 'done') return 'all';
          return currentUserName;
        case 2: // purchase_manager
          if (tabKey === 'purchase' || tabKey === 'done') return 'all';
          return currentUserName; // pending & receipt
        case 3: // 관리자 권한
          return 'all';
        default:
          return currentUserName;
      }
    },
    [currentUserName, roleCase]
  );

  // 탭 변경 또는 사용자/역할 로딩 시 기본값 설정
  useEffect(() => {
    if (!currentUserName) return;
    // 모든 탭의 기본값 계산
    const newDefaults: Record<string, string> = {
      pending: computeDefaultEmployee('pending'),
      purchase: computeDefaultEmployee('purchase'),
      receipt: computeDefaultEmployee('receipt'),
      done: computeDefaultEmployee('done'),
    };
    setFilters(newDefaults);
    setSelectedEmployee(newDefaults[activeTab]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentUserName, roleCase]);

  // 오늘 날짜와 같은지 확인하는 함수입니다. (예: 오늘 등록된 주문서 강조 등)
  const today = new Date();
  const isToday = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  };

  // usePurchaseFilters: 검색어, 탭, 직원 등 조건에 따라 실제로 보여줄 데이터만 골라줍니다.
  const { tabFilteredOrders, orderNumberGroups, displayData: rawDisplayData } = usePurchaseFilters({
    purchases: visiblePurchases,
    activeTab,
    searchTerm,
    selectedEmployee: selectedEmployee ?? '',
    isToday,
  });

  // 기간 필터 적용
  const displayData = rawDisplayData.filter(item => {
    const d = new Date(item.request_date);
    return period[0] && period[1] && d >= period[0] && d <= period[1];
  });

  // 페이지네이션 계산 (그룹 헤더 기준)
  const uniqueOrderNumbers = Array.from(new Set(displayData.map(item => item.purchase_order_number)));
  const totalPages = Math.ceil(uniqueOrderNumbers.length / itemsPerPage);
  const paginatedOrderNumbers = uniqueOrderNumbers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedData = displayData.filter(item => paginatedOrderNumbers.includes(item.purchase_order_number));

  // 필터(탭, 검색, 직원) 변경 시에만 currentPage를 1로 초기화
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, selectedEmployee]);

  // 날짜 변경 시 1페이지로 이동
  useEffect(() => {
    setCurrentPage(1);
  }, [period]);

  // 탭(진행상태) UI의 구분선 위치를 계산합니다. (디자인용)
  useLayoutEffect(() => {
    if (lastTabRef.current) {
      setSepLeft(lastTabRef.current.offsetLeft + lastTabRef.current.offsetWidth);
    }
  }, [NAV_TABS.length, activeTab]);

  // 주문서 그룹(여러 줄짜리)을 펼치거나 접는 함수입니다.
  const toggleGroup = (orderNumber: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(orderNumber)) {
      newExpanded.delete(orderNumber);
    } else {
      newExpanded.add(orderNumber);
    }
    setExpandedGroups(newExpanded);
  };

  // 특정 주문서의 엑셀 파일을 생성하는 함수입니다. (버튼 클릭 시 실행)
  const generateExcelForOrder = async (orderNumber: string) => {
    const orderItems = visiblePurchases.filter(item => item.purchase_order_number === orderNumber);
    if (orderItems.length === 0) {
      alert('해당 발주번호의 데이터를 찾을 수 없습니다.');
      return;
    }

    const firstItem = orderItems[0];
    
    // 업체 상세 정보 및 담당자 정보 조회
    let vendorInfo = {
      vendor_name: firstItem.vendor_name,
      vendor_phone: '',
      vendor_fax: '',
      vendor_contact_name: '',
      vendor_payment_schedule: ''
    };

    try {
      // purchase_requests 테이블에서 vendor_id, contact_id 조회
      const { data: prData, error: prError } = await supabase
        .from('purchase_requests')
        .select('vendor_id, contact_id')
        .eq('purchase_order_number', orderNumber)
        .single();

      if (prData && !prError) {
        const vendorId = prData.vendor_id;
        const contactId = prData.contact_id;
        // vendor 정보 조회
        const { data: vendorData, error: vendorError } = await supabase
          .from('vendors')
          .select('vendor_phone, vendor_fax, vendor_payment_schedule')
          .eq('id', vendorId)
          .single();

        if (vendorData && !vendorError) {
          vendorInfo.vendor_phone = vendorData.vendor_phone || '';
          vendorInfo.vendor_fax = vendorData.vendor_fax || '';
          vendorInfo.vendor_payment_schedule = vendorData.vendor_payment_schedule || '';
        }

        // vendor_contacts에서 contact_id로 담당자 정보 조회
        if (contactId) {
          const { data: contactData, error: contactError } = await supabase
            .from('vendor_contacts')
            .select('contact_name, contact_phone, contact_email')
            .eq('id', contactId)
            .single();
          if (contactData && !contactError) {
            vendorInfo.vendor_contact_name = contactData.contact_name || '';
            // 필요시 vendorInfo에 전화/이메일 등 추가 가능
          }
        }
      }
    } catch (error) {
      console.warn('업체 정보 조회 중 오류:', error);
      // 오류가 발생해도 기본 데이터로 계속 진행
    }

    const excelData = {
      purchase_order_number: firstItem.purchase_order_number || '',
      request_date: firstItem.request_date,
      delivery_request_date: firstItem.delivery_request_date,
      requester_name: firstItem.requester_name,
      vendor_name: vendorInfo.vendor_name,
      vendor_contact_name: vendorInfo.vendor_contact_name,
      vendor_phone: vendorInfo.vendor_phone,
      vendor_fax: vendorInfo.vendor_fax,
      project_vendor: firstItem.project_vendor,
      sales_order_number: firstItem.sales_order_number,
      project_item: firstItem.project_item,
      vendor_payment_schedule: vendorInfo.vendor_payment_schedule,
      items: orderItems.map(item => ({
        line_number: item.line_number,
        item_name: item.item_name,
        specification: item.specification,
        quantity: item.quantity,
        unit_price_value: item.unit_price_value,
        amount_value: item.amount_value,
        remark: item.remark,
        currency: item.currency
      }))
    };

    try {
      // 코드 기반 ExcelJS 생성 (템플릿 없이 서식 직접 정의)
      const blob = await generatePurchaseOrderExcelJS(excelData as PurchaseOrderData);
      const filename = `발주서_${excelData.purchase_order_number}_${excelData.vendor_name}_${formatDateForFileName(excelData.request_date)}.xlsx`;

      // 1) Supabase Storage 업로드 (public bucket: po-files)
      const { error: upErr } = await supabase.storage.from('po-files').upload(filename, blob, {
        upsert: true,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('po-files').getPublicUrl(filename);
      const fileUrl = pub?.publicUrl;

      if (fileUrl) {
        // 2) Slack DM 알림 호출
        await fetch('/api/notify-download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ purchase_order_number: excelData.purchase_order_number, file_url: fileUrl }),
        });
      }
    } catch (uploadErr) {
      console.error('파일 업로드/슬랙 알림 오류:', uploadErr);
    }
  };

  // 파일명 날짜 포맷
  function formatDateForFileName(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return 'unknown_date';
      }
      return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    } catch (error) {
      return 'unknown_date';
    }
  }

  // Compact stats 계산 복구
  const pendingOrderNumbers = Array.from(new Set(visiblePurchases.filter(item => item.middle_manager_status === '대기' || item.final_manager_status === '대기').map(item => item.purchase_order_number)));
  const approvedOrderNumbers = Array.from(new Set(visiblePurchases.filter(item => item.middle_manager_status === '승인' && item.final_manager_status === '승인').map(item => item.purchase_order_number)));
  const stats = {
    total: visiblePurchases.length,
    pending: pendingOrderNumbers.length,
    approved: approvedOrderNumbers.length,
  };

  const getTabCount = useCallback((tabKey: string) => {
    const employeeFilter = filters[tabKey] || '';

    const filtered = visiblePurchases.filter(item => {
      // 날짜 필터 (기간 범위)
      if (period[0] && period[1]) {
        const d = new Date(item.request_date);
        if (d < period[0] || d > period[1]) return false;
      }
      // 직원 필터
      if (employeeFilter !== 'all' && employeeFilter && item.requester_name !== employeeFilter) return false;

      switch (tabKey) {
        case 'pending':
          return ['pending', '대기', '', null].includes(item.final_manager_status as any);
        case 'purchase': {
          // (1) 선진행 & 구매 요청 & 결제 미완료  OR  (2) 일반 & 구매 요청 & 결제 미완료 & 최종승인
          const isRequest = item.payment_category === '구매 요청';
          const notPaid = !item.is_payment_completed;
          if (!isRequest || !notPaid) return false;

          const isSeonJin = (item.progress_type || '').includes('선진행');
          const isIlban = (item.progress_type || '').includes('일반');
          const finalApproved = item.final_manager_status === 'approved';

          return (isSeonJin) || (isIlban && finalApproved);
        }
        case 'receipt': {
          const notReceived = !item.is_received;
          const cond = (item.progress_type || '').includes('선진행') || item.final_manager_status === 'approved';
          return notReceived && cond;
        }
        case 'done':
          return true;
        default:
          return true;
      }
    });
    return new Set(filtered.map(item => item.purchase_order_number)).size;
  }, [visiblePurchases, filters, period]);

  // 구매 현황 탭에서 '대기' 버튼 클릭 시 DB 업데이트 함수
  const handleCompleteReceipt = async (orderNumber: string) => {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('purchase_requests')
        .update({ is_received: true, received_at: now })
        .eq('purchase_order_number', orderNumber);
      if (error) throw error;
      await loadMyRequests(); // DB에서 최신값 반영
    } catch (err: any) {
      window.alert('입고 완료 처리 중 오류가 발생했습니다: ' + (err.message || err));
    }
  };

  // 결제완료 처리 함수
  const handleCompletePayment = async (orderNumber: string) => {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('purchase_requests')
        .update({ is_payment_completed: true, payment_completed_at: now })
        .eq('purchase_order_number', orderNumber);
      if (error) throw error;
      await loadMyRequests(); // DB에서 최신값 반영
    } catch (err: any) {
      window.alert('결제 완료 처리 중 오류가 발생했습니다: ' + (err.message || err));
    }
  };

  const handleEmployeeChange = (employee: string) => {
    setSelectedEmployee(employee);
    setFilters(prev => ({ ...prev, [activeTab]: employee }));
  };

  // New handleDeleteOrder function
  const handleDeleteOrder = async (orderNumber: string) => {
    if (!window.confirm(`발주번호 ${orderNumber} 의 모든 항목을 삭제하시겠습니까?`)) return;
    try {
      // 1) purchase_requests 삭제
      const { error: reqErr } = await supabase
        .from('purchase_requests')
        .delete()
        .eq('purchase_order_number', orderNumber);
      if (reqErr) throw reqErr;

      // 2) purchase_request_items (상세 품목) 삭제
      await supabase
        .from('purchase_request_items')
        .delete()
        .eq('purchase_order_number', orderNumber);

      // 3) 프론트 데이터 새로고침
      await loadMyRequests();
    } catch (err: any) {
      window.alert('주문 삭제 중 오류가 발생했습니다: ' + (err.message || err));
    }
  };

  return (
    <>
      <Card className="flex flex-col bg-card border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 overflow-auto w-full" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <CardHeader className="pt-[16px] pb-0 px-0 bg-muted/20 relative">
          {showEmailButton && (
            <>
              <div className="absolute left-0 top-0 flex items-center justify-center rounded-lg" style={{ width: '36px', height: '87px', borderRadius: '8px' }}>
                <EmailButton
                  inline
                  onClick={onEmailToggle}
                  style={{
                    width: '36px',
                    height: '87px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 0,
                  }}
                />
              </div>
            </>
          )}
          <div className={showEmailButton ? "pl-[60px]" : "pl-8"}>
            <div className="relative flex gap-2 min-h-0 mt-1" style={{ alignItems: 'flex-start', paddingTop: 0, paddingBottom: 0 }}>
              {/* 메인컬러 세로 구분선 (absolute로 시각적 높이 정확히 맞춤) */}
              <div style={{ position: 'absolute', left: 0, top: 6, bottom: 1, width: '4px', borderRadius: '6px', background: 'var(--primary)' }} />
              <div className="flex flex-col gap-0 min-h-0 ml-3">
                <h2 className="font-semibold text-foreground text-[19px] mb-0">발주 현황</h2>
                <p className="text-muted-foreground mt-0 text-[12.3px] mb-0" style={{ marginTop: '0px', marginBottom: '-4px' }}>Purchase Order Management</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0 pt-0 mt-0 gap-0">
          {/* 탭 바를 CardContent로 이동, separator 위에 위치 */}
          <div className="relative flex items-center justify-between w-full" style={{ minWidth: 320 }}>
            <div className="flex">
              {NAV_TABS.map((tab, idx) => (
                <button
                  ref={idx === NAV_TABS.length - 1 ? lastTabRef : undefined}
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    router.replace(`/purchase/list?subtab=${tab.key}`);
                    if (tab.key !== 'done' && currentUserName) {
                      setSelectedEmployee(computeDefaultEmployee(tab.key));
                      setFilters(prev => ({
                        ...prev,
                        [tab.key]: computeDefaultEmployee(tab.key),
                      }));
                    } else if (tab.key === 'done') {
                      setSelectedEmployee('all');
                      setFilters(prev => ({
                        ...prev,
                        done: 'all',
                      }));
                    }
                  }}
                  className={`px-3 py-1 min-w-[72px] font-medium text-[13px] focus:outline-none transition-shadow duration-200
                    ${activeTab === tab.key ? 'text-white bg-gradient-to-r from-primary/90 to-primary/60' : 'text-muted-foreground bg-gray-100'}
                    ${idx === 0 ? 'rounded-tl-xl' : ''}
                    ${idx === NAV_TABS.length - 1 ? 'rounded-tr-xl' : ''}
                    border-0 transition-colors duration-150`}
                  style={{
                    borderLeft: idx !== 0 ? '2px solid #fff' : 'none',
                    boxShadow: '0 -2px 8px 0 rgba(0,0,0,0.10)',
                  }}
                >
                  <span className="tracking-tight">{tab.label.replace('구매 현황', '구매현황').replace('입고 현황', '입고현황')}</span>
                  {/* 텍스트와 숫자 사이 얇은 구분선 */}
                  <div className="mx-auto my-0.5 h-px w-16 bg-border" />
                  <span className={`block text-[11px] font-normal mt-0.5 ${activeTab === tab.key ? 'text-white' : 'text-muted-foreground'}`}>
                    {getTabCount(tab.key)}
                  </span>
                </button>
              ))}
            </div>
            {/* 중앙 기간 필터 버튼 */}
            <div className="absolute left-1/2 -translate-x-1/2 z-10">
              <button
                className="text-[16px] font-semibold text-muted-foreground bg-transparent border-0 shadow-none p-0 m-0 focus:outline-none hover:underline"
                onClick={() => setDateModalOpen(true)}
                type="button"
                style={{ boxShadow: 'none' }}
              >
                {period[0] && period[1] ? `${format(period[0], 'yyyy.MM.dd')} ~ ${format(period[1], 'yyyy.MM.dd')}` : '기간 선택'}
              </button>
            </div>
            {/* 오른쪽 필터 UI */}
            <div className="flex items-center gap-2 ml-auto mt-1">
              <Input
                className="min-w-[180px] max-w-[340px] h-8 text-[13px] border-0 border-b border-border rounded-none shadow-none bg-transparent focus:outline-none focus:shadow-none"
                placeholder="검색(금액 포함)"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <Select value={selectedEmployee || undefined} onValueChange={handleEmployeeChange}>
                <SelectTrigger className="!w-[60px] !min-w-0 !max-w-[60px] !h-8 !px-1 !py-0 text-[12px] border-0 border-b border-border !rounded-none !shadow-none bg-transparent flex-shrink-0 focus:outline-none focus:shadow-none">
                  <SelectValue placeholder="구매요청자" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.name} value={emp.name}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* separator: 완료 오른쪽 위에서 오른쪽 끝까지, absolute */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: sepLeft,
                right: 0,
                height: '1px',
                background: 'var(--border)',
                zIndex: 1,
              }}
            />
          </div>
          {/* 구분선: 탭바 하단에 딱 붙게 */}
          <div
            className="w-full m-0 p-0 bg-gradient-to-r from-primary/90 to-primary/60"
            style={{ height: '2px' }}
          />
          {/* Professional Table - 더 넓은 테이블 */}
          <div className="flex-1 overflow-auto m-0">
            {/* 테이블 렌더링 분리: PurchaseTable 컴포넌트 사용 */}
            <PurchaseTable
              displayData={paginatedData}
              activeTab={activeTab}
              expandedGroups={expandedGroups}
              currentUserName={currentUserName}
              currentUserRoles={currentUserRoles}
              pressedOrder={pressedOrder}
              toggleGroup={toggleGroup}
              generateExcelForOrder={generateExcelForOrder}
              handleCompleteReceipt={handleCompleteReceipt}
              setPressedOrder={setPressedOrder}
              handleCompletePayment={handleCompletePayment}
              handleDeleteOrder={handleDeleteOrder}
            />
            {/* 기존 테이블 렌더링 부분은 PurchaseTable로 이동 */}
            {displayData.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-1 py-4 select-none">
          <button
            className="px-2 py-1 text-xs border rounded disabled:opacity-40 cursor-pointer"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            aria-label="맨앞"
          >
            {'<<'}
          </button>
          <button
            className="px-2 py-1 text-xs border rounded disabled:opacity-40 cursor-pointer"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            aria-label="이전"
          >
            {'<'}
          </button>
          {/* 페이지 숫자 최대 5개 */}
          {(() => {
            const pageButtons: React.ReactNode[] = [];
            let start = Math.max(1, currentPage - 2);
            let end = Math.min(totalPages, start + 4);
            if (end - start < 4) start = Math.max(1, end - 4);
            for (let i = start; i <= end; i++) {
              pageButtons.push(
                <button
                  key={i}
                  className={`px-2 py-1 text-xs border rounded mx-0.5 cursor-pointer ${currentPage === i ? 'bg-primary text-white' : ''}`}
                  onClick={() => setCurrentPage(i)}
                  aria-current={currentPage === i ? 'page' : undefined}
                >
                  {i}
                </button>
              );
            }
            return pageButtons;
          })()}
          <button
            className="px-2 py-1 text-xs border rounded disabled:opacity-40 cursor-pointer"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            aria-label="다음"
          >
            {'>'}
          </button>
          <button
            className="px-2 py-1 text-xs border rounded disabled:opacity-40 cursor-pointer"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            aria-label="맨뒤"
          >
            {'>>'}
          </button>
        </div>
      )}
      <Dialog open={dateModalOpen} onOpenChange={setDateModalOpen}>
        <DialogContent className="max-w-2xl min-w-[540px] py-8 px-8">
          <VisuallyHidden>
            <DialogTitle>기간 선택</DialogTitle>
          </VisuallyHidden>
          <div className="flex flex-row items-start justify-center gap-6">
            <div className="flex flex-col items-center min-w-[220px]">
              <div className="mb-1 text-sm font-semibold text-primary">시작 날짜</div>
              <DatePicker
                value={period[0] as any}
                onChange={d => {
                  setPeriod([d as Date, period[1]]);
                }}
                placeholder="시작 날짜"
                inline
              />
            </div>
            <div className="flex flex-col items-center min-w-[220px]">
              <div className="mb-1 text-sm font-semibold text-primary">종료 날짜</div>
              <DatePicker
                value={period[1] as any}
                onChange={d => {
                  setPeriod([period[0], d as Date]);
                }}
                placeholder="종료 날짜"
                inline
              />
            </div>
          </div>
          <div className="flex justify-center mt-6">
            <button
              className="h-9 min-w-[72px] px-2 rounded-md font-medium text-[15px] text-white bg-gradient-to-r from-primary/95 to-primary/80 shadow-[0_2px_8px_0_rgba(0,0,0,0.22)] hover:from-primary/90 hover:to-primary/70 transition-all duration-150"
              onClick={() => setDateModalOpen(false)}
              type="button"
            >
              적용
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
