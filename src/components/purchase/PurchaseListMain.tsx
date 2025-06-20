"use client";
import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Search, Filter, MoreHorizontal, ChevronDown, ChevronRight, Download, FileSpreadsheet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import EmailButton from "@/components/purchase/EmailButton";
import { supabase } from "@/lib/supabaseClient";
// import { generateSimpleTestExcel } from "@/utils/excelGenerator";
import { generatePurchaseOrderExcelJS, PurchaseOrderData } from "@/utils/exceljs/generatePurchaseOrderExcel";
import Image from "next/image";
import { usePurchaseData } from "@/hooks/usePurchaseData";
import { usePurchaseFilters } from "@/hooks/usePurchaseFilters";
import PurchaseTable from "@/components/purchase/PurchaseTable";

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
  // 검색어, 직원 선택, 탭(진행상태) 등 화면의 상태를 관리합니다.
  const [searchTerm, setSearchTerm] = useState(""); // 검색창에 입력한 내용
  const [selectedEmployee, setSelectedEmployee] = useState('all'); // 선택된 직원, '전체'로 기본값 설정
  const [activeTab, setActiveTab] = useState('pending'); // 현재 선택된 탭(진행상태)
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

  // 오늘 날짜와 같은지 확인하는 함수입니다. (예: 오늘 등록된 주문서 강조 등)
  const today = new Date();
  const isToday = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  };

  // usePurchaseFilters: 검색어, 탭, 직원 등 조건에 따라 실제로 보여줄 데이터만 골라줍니다.
  const { tabFilteredOrders, orderNumberGroups, displayData } = usePurchaseFilters({
    purchases,
    activeTab,
    searchTerm,
    selectedEmployee,
    isToday,
  });

  // 탭(진행상태) UI의 구분선 위치를 계산합니다. (디자인용)
  useLayoutEffect(() => {
    if (lastTabRef.current) {
      setSepLeft(lastTabRef.current.offsetLeft + lastTabRef.current.offsetWidth);
    }
  }, [NAV_TABS.length, activeTab]);

  useEffect(() => {
    if (currentUserName) {
      setFilters(prev => ({
        ...prev,
        pending: currentUserName,
        purchase: currentUserName,
        receipt: currentUserName,
        // done은 그대로 'all' 유지
      }));
    }
  }, [currentUserName]);

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
    const orderItems = purchases.filter(item => item.purchase_order_number === orderNumber);
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
      // ExcelJS 기반으로 생성
      const blob = await generatePurchaseOrderExcelJS(excelData as PurchaseOrderData);
      const filename = `발주서_${excelData.purchase_order_number}_${excelData.vendor_name}_${formatDateForFileName(excelData.request_date)}.xlsx`;
      // 파일 다운로드
      if (window.navigator && (window.navigator as any).msSaveOrOpenBlob) {
        (window.navigator as any).msSaveOrOpenBlob(blob, filename);
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(link.href);
        }, 100);
      }
    } catch (error) {
      console.error('Excel 생성 오류:', error);
      window.alert('Excel 파일 생성 중 오류가 발생했습니다.');
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
  const pendingOrderNumbers = Array.from(new Set(purchases.filter(item => item.middle_manager_status === '대기' || item.final_manager_status === '대기').map(item => item.purchase_order_number)));
  const approvedOrderNumbers = Array.from(new Set(purchases.filter(item => item.middle_manager_status === '승인' && item.final_manager_status === '승인').map(item => item.purchase_order_number)));
  const stats = {
    total: purchases.length,
    pending: pendingOrderNumbers.length,
    approved: approvedOrderNumbers.length,
  };

  const getTabCount = useCallback((tabKey: string) => {
    const employeeFilter = filters[tabKey] || '';

    const isReceiptTabMatch = (item: Purchase) => {
      if (item.is_received === false) {
        if (employeeFilter !== 'all' && employeeFilter && item.requester_name !== employeeFilter) return false;
        const isFinalApproved = item.final_manager_status === 'approved';
        const isAdvance = item.progress_type?.includes('선진행');
        return isFinalApproved || isAdvance;
      }
      if (item.is_received === true && isToday(item.received_at)) {
        if (employeeFilter !== 'all' && employeeFilter && item.requester_name !== employeeFilter) return false;
        const isFinalApproved = item.final_manager_status === 'approved';
        const isAdvance = item.progress_type?.includes('선진행');
        return isFinalApproved || isAdvance;
      }
      return false;
    };

    const filtered = purchases.filter(item => {
      if (employeeFilter !== 'all' && employeeFilter) {
        if (item.requester_name !== employeeFilter) return false;
      }

      switch (tabKey) {
        case 'pending':
          return item.final_manager_status !== 'approved' || (item.final_manager_status === 'approved' && isToday(item.final_manager_approved_at));
        case 'purchase':
          return item.payment_category === '구매 요청' && (!item.is_payment_completed || isToday(item.payment_completed_at));
        case 'receipt':
          return isReceiptTabMatch(item);
        case 'done':
          return true;
        default:
          return true;
      }
    });
    return new Set(filtered.map(item => item.purchase_order_number)).size;
  }, [purchases, filters, isToday]);

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
    setFilters(prev => ({
      ...prev,
      [activeTab]: employee
    }));
  };


  return (
    <Card className="h-full flex flex-col bg-card border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden w-full">
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
      <CardContent className="flex-1 overflow-hidden p-0 pt-0 mt-0 gap-0">
        {/* 탭 바를 CardContent로 이동, separator 위에 위치 */}
        <div className="relative flex items-center justify-between w-full" style={{ minWidth: 320 }}>
          <div className="flex">
            {NAV_TABS.map((tab, idx) => (
              <button
                ref={idx === NAV_TABS.length - 1 ? lastTabRef : undefined}
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1 min-w-[72px] font-medium text-[13px] focus:outline-none transition-shadow duration-200
                  ${activeTab === tab.key ? 'text-white bg-gradient-to-l from-primary/90 to-primary' : 'text-muted-foreground bg-gray-100'}
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
            <Select value={selectedEmployee} onValueChange={handleEmployeeChange}>
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
          className="w-full m-0 p-0"
          style={{ height: '2px', background: 'var(--primary)' }}
        />
        {/* Professional Table - 더 넓은 테이블 */}
        <div className="flex-1 overflow-auto m-0">
          {/* 테이블 렌더링 분리: PurchaseTable 컴포넌트 사용 */}
          <PurchaseTable
            displayData={displayData}
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
  );
}
