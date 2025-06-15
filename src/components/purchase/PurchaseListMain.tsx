"use client";
import { useState, useEffect, useRef } from "react";
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
  unique_row_id: string;
  purchase_order_number?: string;
  request_date: string;
  delivery_request_date: string;
  progress_type: string;
  payment_status: string;
  payment_category: string;
  currency: string;
  request_type: string;
  vendor_name: string;
  vendor_payment_schedule: string;
  vendor_phone?: string;
  vendor_fax?: string;
  vendor_contact_name?: string;
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
  vendor_id?: number;
  contact_name?: string;
}

interface Employee {
  name: string;
  email: string;
}

interface PurchaseListMainProps {
  onEmailToggle?: () => void;
  showEmailButton?: boolean;
}

export default function PurchaseListMain({ onEmailToggle, showEmailButton = true }: PurchaseListMainProps) {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(""); // 초기값 비워두고 로딩 후 설정
  const [activeTab, setActiveTab] = useState("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(true);
  // 담당자 캐시 (vendor_id -> contact_name)
  const contactCache = useRef<{ [vendorId: number]: string }>({});
  const [contactMap, setContactMap] = useState<{ [vendorId: number]: string }>({});

  useEffect(() => {
    if (user?.id) {
      console.log('전체 사용자 정보:', {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata
      });
      loadMyRequests();
      loadEmployees();
    }
    // eslint-disable-next-line
  }, [user?.id]);

  // 초기 로딩 시 현재 사용자로 자동 설정
  useEffect(() => {
    if (currentUserName && !selectedEmployee) {
      console.log('현재 사용자로 설정:', currentUserName);
      setSelectedEmployee(currentUserName);
    }
  }, [currentUserName]);

  // 담당자명 비동기 조회 및 캐싱
  const fetchContactName = async (vendorId: number) => {
    if (!vendorId || contactCache.current[vendorId]) return;
    const { data, error } = await supabase
      .from('vendor_contacts')
      .select('contact_name')
      .eq('vendor_id', vendorId)
      .order('id', { ascending: true })
      .limit(1);
    if (data && data.length > 0) {
      contactCache.current[vendorId] = data[0].contact_name;
      setContactMap(prev => ({ ...prev, [vendorId]: data[0].contact_name }));
    } else {
      contactCache.current[vendorId] = '';
      setContactMap(prev => ({ ...prev, [vendorId]: '' }));
    }
  };

  // 구매업체별 담당자명 미리 조회 (최초 렌더링 시)
  useEffect(() => {
    const vendorIds = Array.from(new Set(purchases.map(p => (p as any).vendor_id).filter(Boolean)));
    vendorIds.forEach(vendorId => {
      if (!contactCache.current[vendorId]) fetchContactName(vendorId);
    });
    // eslint-disable-next-line
  }, [purchases.length]);

  async function loadMyRequests() {
    if (!user) return;
    
    setIsLoadingPurchases(true);
    console.log('발주 데이터 로딩 시작');
    
    try {
      // 전체 발주 데이터를 가져오도록 수정 (필터링은 프론트엔드에서 처리)
      const { data, error } = await supabase
        .from('purchase_request_view')
        .select(`
          purchase_request_id,
          unique_row_id,
          purchase_order_number,
          request_date,
          delivery_request_date,
          progress_type,
          payment_status,
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
          contact_name
        `);
        
      console.log('발주 데이타 조회 결과:', { dataCount: data?.length, error });
        
      if (data) {
        setPurchases(
          (data as Array<Record<string, unknown>>).map((row) => {
            return {
              id: row.purchase_request_id as number,
              unique_row_id: row.unique_row_id as string,
              purchase_order_number: row.purchase_order_number as string,
              request_date: row.request_date as string,
              delivery_request_date: row.delivery_request_date as string,
              progress_type: row.progress_type as string,
              payment_status: row.payment_status as string,
              payment_category: row.payment_category as string,
              currency: row.currency as string,
              request_type: row.request_type as string,
              vendor_name: row.vendor_name as string,
              vendor_payment_schedule: row.vendor_payment_schedule as string,
              requester_name: row.requester_name as string,
              item_name: row.item_name as string,
              specification: row.specification as string,
              quantity: row.quantity as number,
              unit_price_value: row.unit_price_value as number,
              amount_value: row.amount_value as number,
              remark: row.remark as string,
              project_vendor: row.project_vendor as string,
              sales_order_number: row.sales_order_number as string,
              project_item: row.project_item as string,
              line_number: row.line_number as number,
              contact_name: row.contact_name as string,
            } as Purchase;
          })
        );
      }
    } catch (error) {
      console.error('발주 데이터 로딩 오류:', error);
    } finally {
      setIsLoadingPurchases(false);
    }
  }

  async function loadEmployees() {
    if (!user) {
      console.log('사용자 정보가 없습니다');
      setIsLoadingEmployees(false);
      return;
    }
    
    setIsLoadingEmployees(true);
    console.log('직원 정보 로딩 시작, user.id:', user.id);
    
    try {
      // 현재 로그인한 사용자 정보 가져오기 (ID로 먼저 찾기)
      let { data: currentUser, error: userError } = await supabase
        .from('employees')
        .select('name, email')
        .eq('id', user.id)
        .single();
      
      console.log('ID로 사용자 조회 결과:', { currentUser, userError });
      
      // ID로 찾을 수 없으면 이메일로 다시 시도
      if (!currentUser && user.email) {
        console.log('이메일로 사용자 찾기 시도:', user.email);
        const { data: userByEmail, error: emailError } = await supabase
          .from('employees')
          .select('name, email')
          .eq('email', user.email)
          .single();
        
        console.log('이메일로 사용자 조회 결과:', { userByEmail, emailError });
        currentUser = userByEmail;
        userError = emailError;
      }
      
      console.log('최종 사용자 조회 결과:', { currentUser, userError });
      
      if (currentUser) {
        console.log('현재 사용자명 설정:', currentUser.name);
        setCurrentUserName(currentUser.name);
      } else {
        console.log('현재 사용자를 찾을 수 없습니다. user.email로 대체 시도:', user.email);
        // fallback: user.email에서 이름 추출 또는 기본값 설정
        if (user.email) {
          const nameFromEmail = user.email.split('@')[0];
          setCurrentUserName(nameFromEmail);
          console.log('이메일에서 추출한 이름:', nameFromEmail);
        } else {
          // 마지막 방법: 기본값 설정
          setCurrentUserName('기본사용자');
          console.log('기본사용자로 설정');
        }
      }

      // 모든 직원 목록 가져오기
      const { data: employeeList, error: listError } = await supabase
        .from('employees')
        .select('name, email')
        .order('name');
      
      console.log('직원 목록 조회 결과:', { employeeCount: employeeList?.length, listError });
      
      if (employeeList && employeeList.length > 0) {
        setEmployees(employeeList);
      } else {
        // 직원 목록을 가져올 수 없는 경우 기본값 설정
        console.log('직원 목록이 비어있음. 기본 목록 사용');
        setEmployees([{ name: currentUserName || '기본사용자', email: user.email || '' }]);
      }
    } catch (error) {
      console.error('직원 정보를 불러오는데 실패했습니다:', error);
      // 오류 발생 시 기본값 설정
      setCurrentUserName(user.email?.split('@')[0] || '기본사용자');
      setEmployees([{ name: user.email?.split('@')[0] || '기본사용자', email: user.email || '' }]);
    } finally {
      setIsLoadingEmployees(false);
    }
  }

  const filteredData = purchases.filter(item => {
    const lowerSearch = searchTerm.toLowerCase();
    // 모든 주요 컬럼을 하나의 문자열로 합쳐서 검색
    const searchable = [
      item.purchase_order_number,
      item.item_name,
      item.specification,
      item.vendor_name,
      item.contact_name,
      item.requester_name,
      item.remark,
      item.project_vendor,
      item.sales_order_number,
      item.project_item,
      item.progress_type,
      item.payment_status,
      item.payment_category,
      item.currency,
      item.request_type
    ].map(v => (v ?? '').toString().toLowerCase()).join(' ');
    const matchesSearch = lowerSearch === '' || searchable.includes(lowerSearch);
    const matchesEmployee = selectedEmployee === "all" || !selectedEmployee || item.requester_name === selectedEmployee;
    const matchesTab = activeTab === "all" || 
                      (activeTab === "pending" && item.delivery_request_date === "승인대기") ||
                      (activeTab === "approved" && item.delivery_request_date === "승인완료");
    return matchesSearch && matchesEmployee && matchesTab;
  });

  // 발주번호별로 그룹핑
  const groupedData = filteredData.reduce((groups, item) => {
    const key = item.purchase_order_number || 'no-number';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<string, Purchase[]>);

  // 표시할 데이터 생성 (그룹 헤더 + 펼쳐진 항목들)
  const displayData: (Purchase & { isGroupHeader?: boolean; groupSize?: number; isSubItem?: boolean; isLastSubItem?: boolean })[] = [];
  
  Object.entries(groupedData).forEach(([orderNumber, items]) => {
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
      alert('Excel 파일 생성 중 오류가 발생했습니다.');
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

  // 변경: 발주번호(그룹) 수 기준
  const allOrderNumbers = Array.from(new Set(purchases.map(item => item.purchase_order_number)));
  const pendingOrderNumbers = Array.from(new Set(purchases.filter(item => item.delivery_request_date === "승인대기").map(item => item.purchase_order_number)));
  const approvedOrderNumbers = Array.from(new Set(purchases.filter(item => item.delivery_request_date === "승인완료").map(item => item.purchase_order_number)));
  const stats = {
    total: allOrderNumbers.length,
    pending: pendingOrderNumbers.length,
    approved: approvedOrderNumbers.length,
  };

  // 1. 탭 이동 시 펼침 상태 초기화
  useEffect(() => {
    setExpandedGroups(new Set());
  }, [activeTab]);

  return (
    <Card className="h-full flex flex-col bg-card border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden w-full">
      {/* Professional Header */}
      <CardHeader className="pb-4 bg-muted/20 border-b border-border">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <h2 className="font-semibold text-foreground">발주 현황</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Purchase Order Management</p>
            </div>
            {showEmailButton && (
              <EmailButton 
                onClick={() => {
                  if (onEmailToggle) onEmailToggle();
                }}
                inline={true}
                style={{ marginLeft: '8px' }}
              />
            )}
            
            {/* Compact Stats */}
            <div className="flex items-center gap-6 ml-6">
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  <span className="text-sm text-muted-foreground">전체</span>
                </div>
                <span className="text-sm font-semibold text-foreground">{stats.total}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-warning"></div>
                  <span className="text-sm text-muted-foreground">대기</span>
                </div>
                <span className="text-sm font-semibold text-warning">{stats.pending}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success"></div>
                  <span className="text-sm text-muted-foreground">완료</span>
                </div>
                <span className="text-sm font-semibold text-success">{stats.approved}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={generateTestExcel}
              className="gap-1.5 rounded-md h-8 px-3 hover:shadow-sm transition-shadow duration-200 bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">테스트 Excel</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-md h-8 px-3 hover:shadow-sm transition-shadow duration-200">
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">필터</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        {/* Professional Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3 rounded-lg bg-muted/30 border-b border-border h-12 mx-6 mt-2 mb-2 p-1">
            <TabsTrigger 
              value="all" 
              className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow font-medium transition-all duration-200 text-sm h-8 hover:shadow-sm"
            >
              전체목록
            </TabsTrigger>
            <TabsTrigger 
              value="pending" 
              className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm font-medium transition-all duration-200 text-sm h-8"
            >
              승인대기
            </TabsTrigger>
            <TabsTrigger 
              value="approved" 
              className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm font-medium transition-all duration-200 text-sm h-8"
            >
              승인완료
            </TabsTrigger>
          </TabsList>

          {/* Professional Filters - 균형있는 패딩 */}
          <div className="px-6 py-3 border-b border-border bg-background">
            <div className="flex gap-4 items-center">
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-40 h-9 text-sm bg-background border-border rounded-md hover:shadow-sm transition-shadow duration-200">
                  <SelectValue placeholder={
                    isLoadingEmployees ? "로딩 중..." : 
                    currentUserName ? currentUserName : 
                    "직원 선택"
                  } />
                </SelectTrigger>
                <SelectContent className="rounded-md">
                  <SelectItem value="all">전체 보기</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.email} value={employee.name}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="전체 항목 통합검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-9 text-sm bg-background border-border rounded-md hover:shadow-sm focus:shadow-sm transition-shadow duration-200 focus-ring"
                />
              </div>
            </div>
          </div>

          {/* Professional Table - 더 넓은 테이블 */}
          <TabsContent value={activeTab} className="flex-1 overflow-auto m-0">
            <div className="overflow-auto">
              {/* Year indicator */}
              <div className="px-6 py-2 text-xs text-muted-foreground bg-muted/5 border-b border-border">
                <span className="font-medium">2024</span>
              </div>
              <table className="w-full min-w-max">
                <thead className="bg-muted/10 sticky top-0">
                  <tr className="h-12">
                    <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border w-44">발주번호/액션</th>
                    <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-20">구매업체</th>
                    <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-20">담당자</th>
                    <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-16">청구일</th>
                    <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-20">입고요청일</th>
                    <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-20">구매요청자</th>
                    <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-32">품명</th>
                    <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border w-32">규격</th>
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
                    
                    // 전체 데이터 디버깅 (처음 3개만 로그)
                    if (index < 3) {
                      console.log(`데이터 ${index + 1}:`, {
                        purchase_order: item.purchase_order_number,
                        progress_type: item.progress_type,
                        progress_type_length: item.progress_type?.length,
                        progress_type_chars: item.progress_type?.split('').map(char => char.charCodeAt(0))
                      });
                    }
                    
                    // 선진행건 여부 확인 (여러 방법으로 체크)
                    const isAdvancePayment = item.progress_type === '선진행' || 
                                            item.progress_type?.trim() === '선진행' ||
                                            item.progress_type?.includes('선진행');
                    
                    // 선진행건 발견 시 로그
                    if (isAdvancePayment) {
                      console.log('🔴 선진행건 발견!', {
                        purchase_order: item.purchase_order_number,
                        progress_type: item.progress_type,
                        raw_value: JSON.stringify(item.progress_type)
                      });
                    }
                    
                    // 그룹 헤더인지 하위 항목인지 확인
                    const isGroupHeader = item.isGroupHeader;
                    const isSubItem = item.isSubItem;
                    const isLastSubItem = item.isLastSubItem;
                    const isExpanded = expandedGroups.has(item.purchase_order_number || '');
                    const isSingleRowGroup = isGroupHeader && (item.groupSize ?? 1) === 1;
                    const isMultiRowGroupHeader = isGroupHeader && (item.groupSize ?? 1) > 1;
                    
                    // 담당자명 표시
                    const vendorId = (purchases.find(p => p.purchase_order_number === item.purchase_order_number)?.vendor_id) as number;
                    const contactName = contactMap[vendorId] || '';
                    
                    return (
                      <motion.tr
                        key={`${item.unique_row_id}-${isGroupHeader ? 'header' : isSubItem ? 'sub' : 'single'}`}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03, type: "spring", damping: 20 }}
                        className={`transition-colors h-12 relative border-b border-border ${
                          isAdvancePayment 
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
                        <td className="px-3 py-2 text-xs text-foreground font-medium text-center w-44">
                          <div className="flex flex-col items-center gap-1">
                            <span className="truncate flex items-center gap-1">
                              {/* 엑셀 이모티콘은 그룹 헤더(대표) 행에만 보이게 하고, 클릭 시 엑셀 다운로드 */}
                              {isGroupHeader && (
                                <Image
                                  src="/excels-icon.svg"
                                  alt="엑셀 다운로드"
                                  width={16}
                                  height={16}
                                  className="inline-block align-middle cursor-pointer hover:scale-110 transition-transform"
                                  role="button"
                                  tabIndex={0}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await generateExcelForOrder(item.purchase_order_number!);
                                  }}
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      await generateExcelForOrder(item.purchase_order_number!);
                                    }
                                  }}
                                  title="엑셀 발주서 다운로드"
                                />
                              )}
                              {item.purchase_order_number}
                              {isMultiRowGroupHeader && !isExpanded && ` (${item.groupSize}건)`}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-xs text-foreground text-center truncate w-20">{item.vendor_name}</td>
                        <td className="px-2 py-2 text-xs text-foreground text-center truncate w-20">{item.contact_name || ''}</td>
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
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}