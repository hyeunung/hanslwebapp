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
import { useAuth } from "@/app/providers/AuthProvider";
import { generateSimpleTestExcel } from "@/utils/excelGenerator";
import { generatePurchaseOrderExcelJS, PurchaseOrderData } from "@/utils/exceljs/generatePurchaseOrderExcel";
import Image from "next/image";

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

interface PurchaseListMainProps {
  onEmailToggle?: () => void;
  showEmailButton?: boolean;
}

// 네비게이션 탭 정의 (상단 useState들 아래에 위치)
const NAV_TABS: { key: string; label: string }[] = [
  { key: 'pending', label: '승인대기' },
  { key: 'purchase', label: '구매 현황' },
  { key: 'receipt', label: '입고 현황' },
  { key: 'done', label: '전체항목' },
];

export default function PurchaseListMain({ onEmailToggle, showEmailButton = true }: PurchaseListMainProps) {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(''); // 기본값 ''로
  const [activeTab, setActiveTab] = useState('pending');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(true);
  const lastTabRef = useRef<HTMLButtonElement>(null);
  const [sepLeft, setSepLeft] = useState(0);
  const [pressedOrder, setPressedOrder] = useState<string | null>(null);
  const [currentUserRoles, setCurrentUserRoles] = useState<string[]>([]);

  useLayoutEffect(() => {
    if (lastTabRef.current) {
      setSepLeft(lastTabRef.current.offsetLeft + lastTabRef.current.offsetWidth);
    }
  }, [NAV_TABS.length, activeTab]);

  useEffect(() => {
    if (user?.id) {
      loadMyRequests();
      loadEmployees();
    }
  }, [user?.id]);

  // 초기 로딩 시 현재 사용자로 자동 설정
  useEffect(() => {
    if (currentUserName) {
      setSelectedEmployee(currentUserName);
    }
  }, [currentUserName]);

  async function loadMyRequests() {
    if (!user) return;
    setIsLoadingPurchases(true);
    try {
      const { data, error } = await supabase
        .from('purchase_request_view')
        .select(`
          purchase_request_id,
          purchase_order_number,
          request_date,
          delivery_request_date,
          progress_type,
          is_payment_completed,
          payment_completed_at,
          payment_category,
          currency,
          request_type,
          vendor_name,
          vendor_payment_schedule,
          requester_name,
          item_name,
          specification,
          quantity,
          unit_price_value,
          amount_value,
          remark,
          project_vendor,
          sales_order_number,
          project_item,
          line_number,
          contact_name,
          middle_manager_status,
          final_manager_status,
          is_received,
          received_at,
          is_payment_completed
        `);
      if (data) {
        setPurchases(
          (data as Array<Record<string, unknown>>).map((row) => ({
            id: Number(row.purchase_request_id),
            purchase_order_number: row.purchase_order_number as string,
            request_date: row.request_date as string,
            delivery_request_date: row.delivery_request_date as string,
            progress_type: row.progress_type as string,

            payment_completed_at: row.payment_completed_at as string,
            payment_category: row.payment_category as string,
            currency: row.currency as string,
            request_type: row.request_type as string,
            vendor_name: row.vendor_name as string,
            vendor_payment_schedule: row.vendor_payment_schedule as string,
            requester_name: row.requester_name as string,
            item_name: row.item_name as string,
            specification: row.specification as string,
            quantity: Number(row.quantity),
            unit_price_value: Number(row.unit_price_value),
            amount_value: Number(row.amount_value),
            remark: row.remark as string,
            project_vendor: row.project_vendor as string,
            sales_order_number: row.sales_order_number as string,
            project_item: row.project_item as string,
            line_number: Number(row.line_number),
            contact_name: row.contact_name ? String(row.contact_name) : '',
            middle_manager_status: row.middle_manager_status as string,
            final_manager_status: row.final_manager_status as string,
            is_received: !!row.is_received,
            received_at: row.received_at as string,
            is_payment_completed: !!row.is_payment_completed,
          }))
        );
      }
    } catch (error) {
      console.error('발주 데이터 로딩 오류:', error);
      window.alert('발주 데이터 로딩에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsLoadingPurchases(false);
    }
  }

  async function loadEmployees() {
    if (!user) {
      setIsLoadingEmployees(false);
      return;
    }
    
    setIsLoadingEmployees(true);
    try {
      // 현재 로그인한 사용자 정보 가져오기 (ID로 먼저 찾기)
      let { data: currentUser, error: userError } = await supabase
        .from('employees')
        .select('name, email, purchase_role')
        .eq('id', user.id)
        .single();
      
      // ID로 찾을 수 없으면 이메일로 다시 시도
      if (!currentUser && user.email) {
        const { data: userByEmail, error: emailError } = await supabase
          .from('employees')
          .select('name, email, purchase_role')
          .eq('email', user.email)
          .single();
        
        currentUser = userByEmail ? userByEmail : { name: user.email.split('@')[0], email: user.email, purchase_role: [] };
        userError = emailError;
      }
      
      if (currentUser) {
        setCurrentUserName(currentUser.name);
        setCurrentUserRoles(Array.isArray(currentUser.purchase_role) ? currentUser.purchase_role : []);
      } else {
        // fallback: user.email에서 이름 추출 또는 기본값 설정
        if (user.email) {
          const nameFromEmail = user.email.split('@')[0];
          setCurrentUserName(nameFromEmail);
          setCurrentUserRoles([]);
        } else {
          // 마지막 방법: 기본값 설정
          setCurrentUserName('기본사용자');
          setCurrentUserRoles([]);
        }
      }

      // 모든 직원 목록 가져오기
      const { data: employeeList, error: listError } = await supabase
        .from('employees')
        .select('name, email')
        .order('name');
      
      if (employeeList && employeeList.length > 0) {
        setEmployees(employeeList);
      } else {
        // 직원 목록을 가져올 수 없는 경우 기본값 설정
        setEmployees([{ name: user.email?.split('@')[0] || '기본사용자', email: user.email || '', purchase_role: [] }]);
      }
    } catch (error) {
      console.error('직원 정보를 불러오는데 실패했습니다:', error);
      window.alert('직원 정보 로딩에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      // 오류 발생 시 기본값 설정
      setCurrentUserName(user.email?.split('@')[0] || '기본사용자');
      setCurrentUserRoles([]);
      setEmployees([{ name: user.email?.split('@')[0] || '기본사용자', email: user.email || '', purchase_role: [] }]);
    } finally {
      setIsLoadingEmployees(false);
    }
  }

  const today = new Date();
  const isToday = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  };

  // 입고현황 탭 필터 조건 함수 (수정)
  const isReceiptTabMatch = (item: Purchase) => {
    // 1. is_received가 false면 무조건 표시
    if (item.is_received === false) {
      // 이름 필터
      if (selectedEmployee !== 'all' && selectedEmployee) {
        if (item.requester_name !== selectedEmployee) return false;
      }
      // 최종관리자 승인 or 선진행만
      const isFinalApproved = item.final_manager_status === 'approved';
      const isAdvance = item.progress_type?.includes('선진행');
      if (!(isFinalApproved || isAdvance)) return false;
      return true;
    }
    // 2. is_received가 true면 당일(received_at)이고, (최종관리자 승인 or 선진행)만 표시
    if (item.is_received === true && isToday(item.received_at)) {
      // 이름 필터
      if (selectedEmployee !== 'all' && selectedEmployee) {
        if (item.requester_name !== selectedEmployee) return false;
      }
      const isFinalApproved = item.final_manager_status === 'approved';
      const isAdvance = item.progress_type?.includes('선진행');
      if (!(isFinalApproved || isAdvance)) return false;
      return true;
    }
    // 그 외는 표시 안함
    return false;
  };

  // 탭별 필터 적용
  const tabFilteredOrders = activeTab === 'receipt'
    ? purchases.filter(isReceiptTabMatch)
    : activeTab === 'done'
      ? purchases.filter(item => {
          // 검색어 필터만 적용
          if (searchTerm && searchTerm.trim() !== '') {
            const term = searchTerm.trim().toLowerCase();
            const searchable = [
              item.purchase_order_number,
              item.vendor_name,
              item.item_name,
              item.specification,
              item.requester_name,
              item.remark,
              item.project_vendor,
              item.sales_order_number,
              item.project_item,
              item.unit_price_value?.toString(),
              item.unit_price_value ? Number(item.unit_price_value).toLocaleString() : '',
              item.amount_value?.toString(),
              item.amount_value ? Number(item.amount_value).toLocaleString() : '',
            ].map(v => (v || '').toLowerCase()).join(' ');
            if (!searchable.includes(term)) return false;
          }
          return true;
        })
      : purchases.filter(item => {
        // 직원 필터
        if (selectedEmployee !== 'all' && selectedEmployee) {
          if (item.requester_name !== selectedEmployee) return false;
        }
        // 검색어 필터
        if (searchTerm && searchTerm.trim() !== '') {
          const term = searchTerm.trim().toLowerCase();
          const searchable = [
            item.purchase_order_number,
            item.vendor_name,
            item.item_name,
            item.specification,
            item.requester_name,
            item.remark,
            item.project_vendor,
            item.sales_order_number,
            item.project_item,
            item.unit_price_value?.toString(),
            item.unit_price_value ? Number(item.unit_price_value).toLocaleString() : '',
            item.amount_value?.toString(),
            item.amount_value ? Number(item.amount_value).toLocaleString() : '',
          ].map(v => (v || '').toLowerCase()).join(' ');
          if (!searchable.includes(term)) return false;
        }
        // 탭 필터 복원
        if (activeTab === 'pending') {
          // 아직 승인 안된 건 + 오늘 승인된 건만 남김
          return item.final_manager_status !== 'approved' ||
            (item.final_manager_status === 'approved' && isToday(item.final_manager_approved_at));
        }
        if (activeTab === 'purchase') {
          // '구매 요청'이면서 결제(구매) 완료가 아닌 건 + 오늘 결제된 건만 남김
          return item.payment_category === '구매 요청' &&
            (!item.is_payment_completed || isToday(item.payment_completed_at));
        }
        if (activeTab === 'receipt') {
          // 입고현황: 최종승인 또는 선진행 건만, 입고완료가 아닌 건 + 오늘 입고된 건만 남김
          const isFinalApproved = item.final_manager_status === 'approved';
          const isAdvance = item.progress_type?.includes('선진행');
          if (!(isFinalApproved || isAdvance)) return false;
          return item.progress_type !== '입고완료' ||
            (item.progress_type === '입고완료' && isToday(item.received_at));
        }
        if (activeTab === 'done') {
          // 완료: 최종관리자 승인(완료)만으로 표시
          return ['approved', '승인'].includes(item.final_manager_status || '');
        }
        return true;
      });

  // 발주번호별 그룹핑 및 카운트
  const orderNumberGroups = tabFilteredOrders.reduce((acc, item) => {
    const key = item.purchase_order_number || 'no-number';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, Purchase[]>);
  const tabOrderCount = Object.keys(orderNumberGroups).length;

  // 표시할 데이터 생성 (그룹 헤더 + 펼쳐진 항목들)
  const displayData: (Purchase & { isGroupHeader?: boolean; groupSize?: number; isSubItem?: boolean; isLastSubItem?: boolean })[] = [];
  
  Object.entries(orderNumberGroups).forEach(([orderNumber, items]) => {
    if (items.length > 1) {
      // 여러 항목이 있는 경우 그룹 헤더 추가
      const headerItem = { 
        ...items[0], 
        isGroupHeader: true, 
        groupSize: items.length 
      };
      displayData.push(headerItem);
      // 그룹이 펼쳐진 경우 하위 항목들 추가 (대표 제외)
      if (expandedGroups.has(orderNumber)) {
        items.slice(1).forEach((item, index) => {
          displayData.push({ 
            ...item, 
            isSubItem: true,
            isLastSubItem: index === items.length - 2 // slice(1)이므로 -2
          });
        });
      }
    } else {
      // 단일 항목인 경우에도 isGroupHeader: true로 추가
      displayData.push({
        ...items[0],
        isGroupHeader: true,
        groupSize: 1
      });
    }
  });

  // 디버깅용 콘솔로그: displayData의 주요 필드 출력
  if (typeof window !== 'undefined') {
    console.log('[displayData]', displayData.map(row => ({
      purchase_order_number: row.purchase_order_number,
      line_number: row.line_number,
      is_received: row.is_received,
      isGroupHeader: row.isGroupHeader,
      isSubItem: row.isSubItem,
      groupSize: row.groupSize
    })));
  }

  // 그룹 토글 함수
  const toggleGroup = (orderNumber: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(orderNumber)) {
      newExpanded.delete(orderNumber);
    } else {
      newExpanded.add(orderNumber);
    }
    setExpandedGroups(newExpanded);
  };

  // Excel 발주서 생성 함수
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

  // 테스트 Excel 생성 함수
  const generateTestExcel = async () => {
    try {
      console.log('테스트 Excel 생성 시작');
      await generateSimpleTestExcel();
      alert('테스트 Excel 파일이 성공적으로 생성되었습니다!');
    } catch (error) {
      console.error('테스트 Excel 생성 오류:', error);
      alert('테스트 Excel 파일 생성 중 오류가 발생했습니다.');
    }
  };

  // Compact stats 계산 복구
  const pendingOrderNumbers = Array.from(new Set(purchases.filter(item => item.middle_manager_status === '대기' || item.final_manager_status === '대기').map(item => item.purchase_order_number)));
  const approvedOrderNumbers = Array.from(new Set(purchases.filter(item => item.middle_manager_status === '승인' && item.final_manager_status === '승인').map(item => item.purchase_order_number)));
  const stats = {
    total: purchases.length,
    pending: pendingOrderNumbers.length,
    approved: approvedOrderNumbers.length,
  };

  

  

  // 모든 탭의 카운트에 직원/검색어 필터가 실시간 반영되도록 함수 도입 (컴포넌트 내부로 이동)
  const getTabCount = (tabKey: string) => {
    if (tabKey === 'receipt') {
      return Array.from(new Set(
        purchases.filter(isReceiptTabMatch).map(item => item.purchase_order_number || 'no-number')
      )).length;
    }
    if (tabKey === 'done') {
      return Array.from(new Set(
        purchases.filter(item => {
          // 검색어 필터만 적용
          if (searchTerm && searchTerm.trim() !== '') {
            const term = searchTerm.trim().toLowerCase();
            const searchable = [
              item.purchase_order_number,
              item.vendor_name,
              item.item_name,
              item.specification,
              item.requester_name,
              item.remark,
              item.project_vendor,
              item.sales_order_number,
              item.project_item,
              item.unit_price_value?.toString(),
              item.unit_price_value ? Number(item.unit_price_value).toLocaleString() : '',
              item.amount_value?.toString(),
              item.amount_value ? Number(item.amount_value).toLocaleString() : '',
            ].map(v => (v || '').toLowerCase()).join(' ');
            if (!searchable.includes(term)) return false;
          }
          return true;
        }).map(item => item.purchase_order_number || 'no-number')
      )).length;
    }
    return Array.from(new Set(
      purchases.filter((item: Purchase) => {
        // 직원 필터: '전체'일 때는 무시 (승인대기, 구매현황, 입고현황 탭에서만)
        if (['pending', 'purchase', 'receipt'].includes(tabKey)) {
          // '전체'면 필터 무시, 아니면 필터 적용
          if (selectedEmployee !== 'all' && selectedEmployee) {
            if (item.requester_name !== selectedEmployee) return false;
          }
        } else {
          // 그 외 탭(예: done)에서는 기존대로 적용
          if (selectedEmployee !== 'all' && selectedEmployee) {
            if (item.requester_name !== selectedEmployee) return false;
          }
        }
        // 검색어 필터
        if (searchTerm && searchTerm.trim() !== '') {
          const term = searchTerm.trim().toLowerCase();
          const searchable = [
            item.purchase_order_number,
            item.vendor_name,
            item.item_name,
            item.specification,
            item.requester_name,
            item.remark,
            item.project_vendor,
            item.sales_order_number,
            item.project_item,
            item.unit_price_value?.toString(),
            item.unit_price_value ? Number(item.unit_price_value).toLocaleString() : '',
            item.amount_value?.toString(),
            item.amount_value ? Number(item.amount_value).toLocaleString() : '',
          ].map(v => (v || '').toLowerCase()).join(' ');
          if (!searchable.includes(term)) return false;
        }
        // 탭별 조건
        if (tabKey === 'pending') {
          return item.final_manager_status !== 'approved';
        }
        if (tabKey === 'purchase') {
          return item.payment_category === '구매 요청' && !item.is_payment_completed;
        }
        if (tabKey === 'receipt') {
          const isFinalApproved = item.final_manager_status === 'approved';
          const isAdvance = item.progress_type?.includes('선진행');
          if (!(isFinalApproved || isAdvance)) return false;
          
          return item.progress_type !== '입고완료' ||
            (item.progress_type === '입고완료' && isToday(item.received_at));
        }
        if (tabKey === 'done') {
          return ['approved', '승인'].includes(item.final_manager_status || '');
        }
        return true;
      }).map(item => item.purchase_order_number || 'no-number')
    )).length;
  };

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
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
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
          <table className="w-full min-w-max">
            <thead className="bg-muted/10 sticky top-0">
              <tr className="h-12">
                {activeTab === 'done' ? (
                  <>
                    <th className="text-center px-1 py-2 text-xs font-medium text-muted-foreground border-b border-border w-14">승인상태</th>
                    <th className="text-center px-1 py-2 text-xs font-medium text-muted-foreground border-b border-border w-14">입고현황</th>
                    <th className="text-center px-1 py-2 text-xs font-medium text-muted-foreground border-b border-border w-14">구매현황</th>
<th className="text-center px-1 py-2 text-xs font-medium text-muted-foreground border-b border-border w-14">결제 종류</th>
                  </>
                ) : activeTab === 'purchase' ? (
                  <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-24">구매 현황</th>
                ) : activeTab === 'receipt' ? (
                  <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-24">입고 상태</th>
                ) : (
                  <th className="text-center px-1 py-2 text-xs font-medium text-muted-foreground border-b border-border w-24">승인상태</th>
                )}
                <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border w-46">발주번호 / 품명 수</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-20">구매업체</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-20">담당자</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-16">청구일</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-20">입고요청일</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-20">구매요청자</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-32">품명</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-16">규격</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-16">수량</th>
                <th className="text-right px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-24">단가(₩)</th>
                <th className="text-right px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-24">합계(₩)</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-32">비고</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-16">PJ업체</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-16">수주번호</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-16">item</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-16">지출예정일</th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((item, index) => {
                
                // 날짜 포맷팅 (월-일만 표시)
                const formatDate = (dateStr: string) => {
                  if (!dateStr) return '';
                  const date = new Date(dateStr);
                  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                };
                
                // 통화 포맷팅
                const formatCurrency = (value: number, currency: string) => {
                  const formatter = new Intl.NumberFormat('ko-KR');
                  const currencySymbols: { [key: string]: string } = {
                    'KRW': '₩',
                    'USD': '$',
                    'EUR': '€',
                    'JPY': '¥',
                    'CNY': '¥'
                  };
                  const symbol = currencySymbols[currency] || currency;
                  return `${formatter.format(value)} ${symbol}`;
                };
                
                // 선진행건 여부 확인 (여러 방법으로 체크)
                const isAdvancePayment = item.progress_type === '선진행' || 
                                        item.progress_type?.trim() === '선진행' ||
                                        item.progress_type?.includes('선진행');
                
                // 그룹 헤더인지 하위 항목인지 확인
                const isGroupHeader = item.isGroupHeader;
                const isSubItem = item.isSubItem;
                const isLastSubItem = item.isLastSubItem;
                const isExpanded = expandedGroups.has(item.purchase_order_number || '');
                const isSingleRowGroup = isGroupHeader && (item.groupSize ?? 1) === 1;
                const isMultiRowGroupHeader = isGroupHeader && (item.groupSize ?? 1) > 1;
                
                // 담당자명 표시
                const contactName = item.contact_name || '';
                
                // 고유 key 생성: purchase_order_number + line_number + 타입
                const keyType = isGroupHeader ? 'header' : isSubItem ? 'sub' : 'single';
                const key = `${item.purchase_order_number}-${item.line_number ?? 0}-${keyType}`;
                
                return (
                  <motion.tr
                    key={key}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03, type: "spring", damping: 20 }}
                    className={`transition-colors h-12 relative border-b border-border ${
                      activeTab === 'pending' && isAdvancePayment
                        ? 'bg-rose-100 !bg-rose-100'
                        : isAdvancePayment
                        ? 'bg-rose-100 hover:bg-rose-150 !bg-rose-100'
                        : isSubItem
                        ? isLastSubItem
                          ? 'bg-gray-50 hover:bg-blue-50 cursor-pointer'
                          : 'bg-gray-50 hover:bg-gray-100'
                        : isMultiRowGroupHeader
                        ? isExpanded
                          ? 'bg-blue-50 hover:bg-blue-100 cursor-pointer'
                          : 'hover:bg-blue-50 cursor-pointer'
                        : isSingleRowGroup
                        ? 'bg-white cursor-pointer'
                        : 'hover:bg-muted/10'
                    }`}
                    style={{
                      backgroundColor: isAdvancePayment ? '#ffe4e6' : undefined,
                      // 그룹(2행 이상) 펼침 시 굵은 테두리
                      ...(isMultiRowGroupHeader && isExpanded && {
                        borderLeft: '4px solid #3b82f6',
                        borderRight: '4px solid #3b82f6',
                        borderTop: '4px solid #3b82f6'
                      }),
                      ...(isSubItem && !isLastSubItem && {
                        borderLeft: '4px solid #3b82f6',
                        borderRight: '4px solid #3b82f6'
                      }),
                      ...(isLastSubItem && {
                        borderLeft: '4px solid #3b82f6',
                        borderRight: '4px solid #3b82f6',
                        borderBottom: '4px solid #3b82f6'
                      }),
                      // 1행짜리: 클릭 시 파란색 테두리
                      ...(isSingleRowGroup && expandedGroups.has(item.purchase_order_number || '') && {
                        border: '4px solid #3b82f6'
                      })
                    }}
                    onClick={() => {
                      // 그룹(2행 이상) 헤더 또는 마지막 하위 항목만 토글
                      // 1행짜리는 자기 자신만 토글(파란 테두리)
                      if ((isMultiRowGroupHeader || isLastSubItem || isSingleRowGroup) && item.purchase_order_number) {
                        toggleGroup(item.purchase_order_number);
                      }
                    }}
                  >
                    {activeTab === 'done' ? (
                      <>
                        {/* 승인상태(최종) */}
                        {isGroupHeader ? (
                          <td className="px-1 py-2 text-xs text-foreground text-center w-14">
                            <span className={`inline-block px-2 py-1 rounded-lg font-semibold select-none`}
                              style={{
                                minWidth: 40,
                                boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)',
                                border: 'none',
                                background: item.final_manager_status === 'approved' ? '#22c55e' : '#e5e7eb',
                                color: item.final_manager_status === 'approved' ? '#fff' : '#222',
                              }}>
                              {item.final_manager_status === 'pending' ? '대기' : item.final_manager_status === 'approved' ? '승인' : item.final_manager_status}
                            </span>
                          </td>
                        ) : <td className="w-14" />}
                        {/* 입고현황 */}
                        {isGroupHeader ? (
                          <td className="px-1 py-2 text-xs text-foreground text-center w-14">
                            <span className={`inline-block px-2 py-1 rounded-lg font-semibold select-none`}
                              style={{
                                minWidth: 40,
                                boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)',
                                border: 'none',
                                background: item.is_received ? '#22c55e' : '#e5e7eb',
                                color: item.is_received ? '#fff' : '#222',
                              }}>
                              {item.is_received ? '입고' : '대기'}
                            </span>
                          </td>
                        ) : <td className="w-14" />}
                        {/* 구매현황 */}
                        {isGroupHeader ? (
                          <td className="px-1 py-2 text-xs text-foreground text-center w-14">
                            {item.payment_category === '구매 요청' ? (
                              <span className={`inline-block px-2 py-1 rounded-lg font-semibold select-none`}
                                style={{
                                  minWidth: 40,
                                  boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)',
                                  border: 'none',
                                  background: item.is_received ? '#22c55e' : '#e5e7eb',
                                  color: item.is_received ? '#fff' : '#222',
                                }}>
                                {item.is_received ? '입고' : '대기'}
                              </span>
                            ) : ''}
                          </td>
                        ) : <td className="w-14" />}
                        {/* 결제 종류 */}
                        {isGroupHeader ? (
                          <td className="px-1 py-2 text-xs text-foreground text-center w-14">
                            {item.payment_category}
                          </td>
                        ) : <td className="w-14" />}
                      </>
                    ) : activeTab === 'purchase' ? (
                      // 구매 현황 칼럼
                      isGroupHeader ? (
                        <td className="px-2 py-2 text-xs text-foreground text-center w-24" style={{ overflow: 'visible' }}>
                          {item.is_payment_completed ? (
                            <span
                              className="inline-block px-2 py-1 rounded-lg font-semibold bg-green-500 text-white select-none"
                              style={{ minWidth: 40, boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)', border: 'none' }}
                            >
                              완료
                            </span>
                          ) : (
                            <span
                              className="inline-block px-2 py-1 rounded-lg font-semibold bg-gray-200 text-gray-800 select-none"
                              style={{ minWidth: 40, boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)', border: 'none' }}
                            >
                              대기
                            </span>
                          )}
                        </td>
                      ) : <td className="w-24" />
                    ) : activeTab === 'receipt' ? (
                      // 입고 상태 칼럼
                      isGroupHeader ? (
                        <td className="px-2 py-2 text-xs text-foreground text-center w-24" style={{ overflow: 'visible' }}>
                          {item.is_received ? (
                            <span
                              className={
                                `inline-block px-2 py-1 rounded-lg font-semibold bg-green-500 text-white select-none`
                              }
                              style={{
                                minWidth: 40,
                                boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)',
                                border: 'none',
                              }}
                            >
                              입고
                            </span>
                          ) : (
                            currentUserName === item.requester_name || currentUserRoles.includes('app_admin') ? (
                              <button
                                className={`inline-block px-2 py-1 rounded-lg font-semibold bg-gray-200 text-gray-800 transition-all duration-150 focus:outline-none select-none relative overflow-hidden ${pressedOrder === item.purchase_order_number ? 'scale-90' : ''}`}
                                style={{
                                  minWidth: 40,
                                  boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)',
                                  border: 'none',
                                  cursor: 'pointer',
                                }}
                                onClick={async e => {
                                  e.stopPropagation();
                                  setPressedOrder(item.purchase_order_number || '');
                                  await handleCompleteReceipt(item.purchase_order_number!);
                                  setPressedOrder(null);
                                }}
                              >
                                입고
                              </button>
                            ) : (
                              <span className={`inline-block px-2 py-1 rounded-lg font-semibold bg-gray-200 text-gray-800 opacity-60 select-none`} style={{ minWidth: 40, boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)', border: 'none', cursor: 'not-allowed' }}>대기</span>
                            )
                          )}
                        </td>
                      ) : <td className="w-24" />
                    ) : (
                      // 승인상태 칼럼
                      <td className="px-2 py-2 text-xs text-foreground text-center w-35">
                        {isGroupHeader ? (
                          <>
                            <span
                              className={`inline-block px-2 py-1 rounded-lg font-semibold bg-gray-200 text-gray-800`}
                              style={{ minWidth: 40, marginRight: 4, boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)', border: 'none' }}
                            >
                              {item.middle_manager_status === 'pending' ? '대기' : item.middle_manager_status === 'approved' ? '승인' : item.middle_manager_status}
                            </span>
                            /
                            <span
                              className={`inline-block px-2 py-1 rounded-lg font-semibold bg-gray-200 text-gray-800`}
                              style={{ minWidth: 40, marginLeft: 4, boxShadow: '0 2px 3px 0.5px rgba(0,0,0,0.15)', border: 'none' }}
                            >
                              {item.final_manager_status === 'pending' ? '대기' : item.final_manager_status === 'approved' ? '승인' : item.final_manager_status}
                            </span>
                          </>
                        ) : ''}
                      </td>
                    )}
                    {/* 이하 기존 컬럼들 그대로 */}
                    <td className="px-3 py-2 text-xs text-foreground font-medium text-center w-46">
                      <div className="flex flex-col items-center gap-1">
                        <span className="truncate flex items-center gap-1">
                          {isGroupHeader && (
  <Image
    src="/excels-icon.svg"
    alt="엑셀 다운로드"
    width={16}
    height={16}
    className={`inline-block align-middle transition-transform
      ${isAdvancePayment || item.final_manager_status === 'approved' ? 'cursor-pointer hover:scale-110' : 'opacity-40 grayscale cursor-not-allowed'}`}
    role="button"
    tabIndex={isAdvancePayment || item.final_manager_status === 'approved' ? 0 : -1}
    onClick={async (e) => {
      if (isAdvancePayment || item.final_manager_status === 'approved') {
        e.stopPropagation();
        await generateExcelForOrder(item.purchase_order_number!);
      }
    }}
    onKeyDown={async (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && (isAdvancePayment || item.final_manager_status === 'approved')) {
        e.preventDefault();
        e.stopPropagation();
        await generateExcelForOrder(item.purchase_order_number!);
      }
    }}
    style={{
      filter: !isAdvancePayment && item.final_manager_status !== 'approved' ? 'grayscale(1) opacity(0.4)' : undefined,
      pointerEvents: !isAdvancePayment && item.final_manager_status !== 'approved' ? 'none' : 'auto'
    }}
    title="엑셀 발주서 다운로드"
  />
)}
                          {item.purchase_order_number}
                          {isGroupHeader && item.groupSize && item.groupSize > 1 && ` (${item.groupSize}건)`}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-xs text-foreground text-center truncate w-20">{item.vendor_name}</td>
                    <td className="px-2 py-2 text-xs text-foreground text-center truncate w-20">{item.contact_name || '-'}</td>
                    <td className="px-2 py-2 text-xs text-foreground text-center w-16 truncate">{formatDate(item.request_date)}</td>
                    <td className="px-2 py-2 text-xs text-foreground text-center w-20 truncate">{formatDate(item.delivery_request_date)}</td>
                    <td className="px-2 py-2 text-xs text-foreground text-center truncate w-20">{item.requester_name}</td>
                    <td className="px-2 py-2 text-xs text-foreground text-center truncate w-32">{item.item_name}</td>
                    <td className="px-2 py-2 text-xs text-foreground truncate w-32 relative">
                      {item.specification}
                    </td>
                    <td className="px-2 py-2 text-xs text-foreground text-center w-16 truncate">{item.quantity}</td>
                    <td className="px-2 py-2 text-xs text-foreground text-right w-24 truncate">{formatCurrency(item.unit_price_value, item.currency)}</td>
                    <td className="px-2 py-2 text-xs text-foreground text-right w-24 truncate">{formatCurrency(item.amount_value, item.currency)}</td>
                    <td className="px-2 py-2 text-xs text-foreground text-center truncate w-32">{item.remark}</td>
                    <td className="px-2 py-2 text-xs text-foreground text-center truncate w-16">{item.project_vendor}</td>
                    <td className="px-2 py-2 text-xs text-foreground text-center truncate w-16">{item.sales_order_number}</td>
                    <td className="px-2 py-2 text-xs text-foreground text-center truncate w-16">{item.project_item}</td>
                    <td className="px-2 py-2 text-xs text-foreground text-center truncate w-16">{item.vendor_payment_schedule}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
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