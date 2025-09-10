"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePurchaseData } from "@/hooks/usePurchaseData";

// 직원 데이터 타입 정의
interface Employee {
  id: string;
  employeeID?: string;
  name: string;
  email: string;
  phone?: string;
  position?: string;
  department?: string;
  join_date?: string;
  birthday?: string;
  bank?: string;
  bank_account?: string;
  adress?: string;
  annual_leave_granted_current_year?: number;
  used_annual_leave?: number;
  remaining_annual_leave?: number;
}

// 편집 가능한 필드들 타입 정의
interface EditableEmployeeFields {
  name: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  join_date: string;
  birthday: string;
  bank: string;
  bank_account: string;
  adress: string;
  annual_leave_granted_current_year: number;
  used_annual_leave: number;
  remaining_annual_leave: number;
}

export default function EmployeeMain() {
  // 직원 목록 상태
  const [employees, setEmployees] = useState<Employee[]>([]);
  // 로딩 상태
  const [loading, setLoading] = useState(true);
  // 검색어 상태
  const [searchTerm, setSearchTerm] = useState("");
  // 편집 상태 관리
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<EditableEmployeeFields>>({});
  // 새 직원 추가 모달 상태 관리
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [addEmployeeForm, setAddEmployeeForm] = useState<Partial<EditableEmployeeFields>>({});
  const [addEmployeeLoading, setAddEmployeeLoading] = useState(false);
  const [addEmployeeError, setAddEmployeeError] = useState<string | null>(null);
  
  const { currentUserRole } = usePurchaseData();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("employees")
      .select("id, employeeID, name, email, phone, position, department, join_date, birthday, bank, bank_account, adress, annual_leave_granted_current_year, used_annual_leave, remaining_annual_leave");
    
    if (!error && data) {
      setEmployees(data);
    }
    setLoading(false);
  };

  // 새 직원 추가 모달 시작
  const startAddingEmployee = () => {
    
    // 추가 권한 체크
    if (!canEdit) {
      alert('직원 추가 권한이 없습니다. 관리자에게 문의하세요.');
      return;
    }
    
    // 기존 편집 모드가 있으면 취소 확인
    if (editingEmployeeId) {
      const confirmCancel = window.confirm('현재 편집 중인 직원이 있습니다. 편집을 취소하고 새 직원을 추가하시겠습니까?');
      if (!confirmCancel) {
        return;
      }
      // 기존 편집 모드 취소
      setEditingEmployeeId(null);
      setEditValues({});
    }
    
    // 모달 열기 및 초기값 설정
    setShowAddEmployeeModal(true);
    setAddEmployeeForm({
      name: '',
      email: '',
      phone: '',
      position: '',
      department: '',
      join_date: '',
      birthday: '',
      bank: '',
      bank_account: '',
      adress: '',
      annual_leave_granted_current_year: 0,
      remaining_annual_leave: 0
    });
    setAddEmployeeError(null);
    
  };

  // 새 직원 추가 취소
  const cancelAddingEmployee = () => {
    
    setShowAddEmployeeModal(false);
    setAddEmployeeForm({});
    setAddEmployeeError(null);
    
  };

  // 새 직원 저장
  const saveNewEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setAddEmployeeError(null);
    
    // 1. 필수 필드 검증
    if (!addEmployeeForm.name?.trim()) {
      setAddEmployeeError('이름을 입력해 주세요.');
      return;
    }
    
    if (!addEmployeeForm.email?.trim()) {
      setAddEmployeeError('이메일을 입력해 주세요.');
      return;
    }
    
    // 2. 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(addEmployeeForm.email)) {
      setAddEmployeeError('올바른 이메일 형식을 입력해주세요.');
      return;
    }
    
    // 3. 데이터 정리 (빈 문자열을 null로 변환)
    const cleanData: any = Object.entries(addEmployeeForm).reduce((acc: any, [key, value]) => {
      if (value === '' || value === undefined) {
        acc[key] = null;
      } else {
        acc[key] = value;
      }
      return acc;
    }, {});
    
    
    try {
      setAddEmployeeLoading(true);
      
      const { data, error } = await supabase
        .from('employees')
        .insert([cleanData])
        .select(); // 삽입된 데이터 반환
        
        
      if (error) {
        throw new Error(`데이터베이스 오류: ${error.message}`);
      }
      
      if (!data || data.length === 0) {
        throw new Error('직원 추가가 처리되지 않았습니다. 권한을 확인해주세요.');
      }
      
      
      // 4. 모달 닫기
      setShowAddEmployeeModal(false);
      setAddEmployeeForm({});
      
      // 5. 데이터 새로고침
      await fetchAll();
      
      // 6. 성공 알림
      alert(`새 직원 "${cleanData.name}"이 성공적으로 추가되었습니다!`);
      
      
    } catch (error: any) {
      
      // 구체적인 에러 메시지 제공
      if (error.message) {
        if (error.message.includes('permission')) {
          setAddEmployeeError('추가 권한이 없습니다. 관리자에게 문의하세요.');
        } else if (error.message.includes('duplicate') || error.message.includes('unique')) {
          setAddEmployeeError('이미 존재하는 이메일입니다. 다른 이메일을 사용해주세요.');
        } else if (error.message.includes('violates')) {
          setAddEmployeeError('데이터 제약 조건에 위배됩니다.');
        } else {
          setAddEmployeeError(`추가 실패: ${error.message}`);
        }
      } else {
        setAddEmployeeError('새 직원 추가에 실패했습니다.');
      }
    } finally {
      setAddEmployeeLoading(false);
    }
  };

  // 직원 추가 폼 입력값 변경 핸들러
  const handleAddEmployeeFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAddEmployeeForm(prev => ({ ...prev, [name]: value }));
  };

  // 편집 모드 시작 - 개선된 버전
  const startEditing = (employee: Employee) => {
    
    // 편집 권한 체크
    if (!canEdit) {
      alert('편집 권한이 없습니다. 관리자에게 문의하세요.');
      return;
    }
    
    setEditingEmployeeId(employee.id);
    
    const initialValues = {
      name: employee.name || '',
      email: employee.email || '',
      phone: employee.phone || '',
      position: employee.position || '',
      department: employee.department || '',
      join_date: employee.join_date || '',
      birthday: employee.birthday || '',
      bank: employee.bank || '',
      bank_account: employee.bank_account || '',
      adress: employee.adress || '',
      annual_leave_granted_current_year: employee.annual_leave_granted_current_year || 0,
      used_annual_leave: employee.used_annual_leave || 0,
      remaining_annual_leave: employee.remaining_annual_leave || 0
    };
    
    setEditValues(initialValues);
  };

  // 편집 취소 - 개선된 버전
  const cancelEditing = () => {
    
    // 변경된 내용이 있는지 확인
    const hasUnsavedChanges = Object.keys(editValues).length > 0;
    
    if (hasUnsavedChanges) {
      const confirmCancel = window.confirm('저장하지 않은 변경사항이 있습니다. 정말 취소하시겠습니까?');
      if (!confirmCancel) {
        return;
      }
    }
    
    setEditingEmployeeId(null);
    setEditValues({});
  };

  // 편집 저장 - 완전 개선된 버전
  const saveEditing = async () => {
    
    // 1. 기본 조건 체크
    if (!editingEmployeeId) {
      alert('편집 중인 직원이 없습니다.');
      return;
    }
    
    // 2. 편집값 존재 여부 체크
    if (!editValues || Object.keys(editValues).length === 0) {
      alert('수정할 내용이 없습니다.');
      return;
    }
    
    // 3. 현재 편집 중인 직원 찾기
    const currentEmployee = employees.find(emp => emp.id === editingEmployeeId);
    if (!currentEmployee) {
      alert('편집 중인 직원 정보를 찾을 수 없습니다.');
      return;
    }
    
    
    // 4. 실제 변경된 필드만 필터링
    const changedFields: any = {};
    let hasChanges = false;
    
    Object.entries(editValues).forEach(([key, value]) => {
      const currentValue = currentEmployee[key as keyof Employee];
      const newValue = value;
      
      // 값이 실제로 변경되었는지 확인 (문자열 비교를 위해 둘 다 문자열로 변환)
      const currentStr = String(currentValue || '').trim();
      const newStr = String(newValue || '').trim();
      
      if (currentStr !== newStr) {
        changedFields[key] = newValue;
        hasChanges = true;
      }
    });
    
    // 5. 변경사항이 없으면 저장하지 않음
    if (!hasChanges) {
      alert('변경된 내용이 없습니다.');
      return;
    }
    
    
    // 6. 필수 필드 검증
    const requiredFields = ['name', 'email'];
    const finalData = { ...currentEmployee, ...changedFields };
    
    for (const field of requiredFields) {
      const value = finalData[field as keyof Employee];
      if (!value || String(value).trim() === '') {
        alert(`${field === 'name' ? '이름' : '이메일'}은 필수 입력 항목입니다.`);
        return;
      }
    }
    
    // 7. 이메일 형식 검증
    if (changedFields.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(changedFields.email)) {
        alert('올바른 이메일 형식을 입력해주세요.');
        return;
      }
    }
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('employees')
        .update(changedFields)
        .eq('id', editingEmployeeId)
        .select(); // 업데이트된 데이터 반환
        
        
      if (error) {
        throw new Error(`데이터베이스 오류: ${error.message}`);
      }
      
      if (!data || data.length === 0) {
        throw new Error('업데이트가 처리되지 않았습니다. 권한을 확인해주세요.');
      }
      
      
      // 8. 편집 모드 종료
      setEditingEmployeeId(null);
      setEditValues({});
      
      // 9. 데이터 새로고침
      await fetchAll();
      
      // 10. 성공 알림
      const updatedFieldsStr = Object.keys(changedFields).join(', ');
      alert(`직원 정보가 성공적으로 수정되었습니다!\n수정된 필드: ${updatedFieldsStr}`);
      
      
    } catch (error: any) {
      
      // 구체적인 에러 메시지 제공
      let errorMessage = '수정에 실패했습니다.';
      
      if (error.message) {
        if (error.message.includes('permission')) {
          errorMessage = '수정 권한이 없습니다. 관리자에게 문의하세요.';
        } else if (error.message.includes('duplicate')) {
          errorMessage = '중복된 정보가 있습니다. 다른 값으로 시도해주세요.';
        } else if (error.message.includes('violates')) {
          errorMessage = '데이터 제약 조건에 위배됩니다.';
        } else {
          errorMessage = `수정 실패: ${error.message}`;
        }
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 편집값 업데이트 - 개선된 버전
  const updateEditValue = (field: keyof EditableEmployeeFields, value: any) => {
    
    setEditValues(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      return updated;
    });
  };

  // 편집값 가져오기 - 개선된 버전
  const getEditValue = (employee: Employee, field: keyof EditableEmployeeFields) => {
    if (editingEmployeeId === employee.id) {
      const editValue = editValues[field];
      const originalValue = employee[field];
      
      // undefined/null 처리 개선
      if (editValue !== undefined) {
        return editValue;
      }
      
      return originalValue ?? '';
    }
    return employee[field] ?? '';
  };

  // 편집 중인지 확인
  const isEditing = (employee: Employee) => {
    return editingEmployeeId === employee.id;
  };

  // 검색 필터
  const filteredEmployees = employees.filter(emp => {
    const text = [emp.employeeID, emp.name, emp.email, emp.phone, emp.position, emp.department, emp.join_date, emp.birthday, emp.bank, emp.bank_account, emp.adress, emp.annual_leave_granted_current_year?.toString(), emp.used_annual_leave?.toString(), emp.remaining_annual_leave?.toString()].join(" ").toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  // role이 hr, admin이 아니면 제한된 컬럼만 보여줌
  const isHRorAdmin = currentUserRole === 'hr' || currentUserRole === 'admin';
  // 수정 권한 체크 (HR, Admin만 수정 가능)
  const canEdit = currentUserRole === 'hr' || currentUserRole === 'admin';
  // 박스 최대 가로폭 조건부 스타일 (생성연차 컬럼 추가로 기본 너비 증가)
  const boxMaxWidth = isHRorAdmin ? '1400px' : '980px';

  return (
    <div>
      <div
        className="bg-white rounded-lg shadow-lg p-0 border border-border w-full"
        {...(!isHRorAdmin ? { style: { maxWidth: boxMaxWidth, marginLeft: 0, marginRight: 'auto' } } : {})}
      >
        {/* 상단 헤더 */}
        <div className="pt-[16px] pb-0 px-0 flex items-center justify-between">
          <div className="relative flex gap-2 min-h-0 mt-1 pl-12" style={{ alignItems: 'flex-start', paddingTop: 0, paddingBottom: 0 }}>
            <div style={{ position: 'absolute', left: 30, top: 5, bottom: 0, width: '4px', borderRadius: '6px', background: '#FFD600' }} />
            <div className="flex flex-col gap-1 min-h-0">
              <h2 className="font-semibold text-foreground text-[19px] mb-0">
                직원관리
                <span className="text-muted-foreground text-[14px] font-normal ml-2 align-middle">총 {filteredEmployees.length}명</span>
              </h2>
              <p className="text-muted-foreground text-[12.3px] font-normal mt-0 mb-0" style={{marginTop:'-2px',marginBottom:'-4px'}}>Employee Management</p>
            </div>
          </div>
        </div>
        <hr className="border-t border-border mt-6 mb-2" />
        <div className="p-0">
          {/* 검색창과 직원 추가 버튼 */}
          <div className="flex items-center gap-1 mb-3 mt-10 pl-8">
            <div className="relative w-full max-w-[400px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="16.5" y1="16.5" x2="21" y2="21" />
                </svg>
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="검색(이름/이메일/연락처 등)"
                className="w-full h-8 text-[13px] border border-border rounded-lg bg-white shadow-none pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            
            {/* 직원 추가 버튼 */}
            {canEdit && (
              <button
                onClick={startAddingEmployee}
                className="px-3 py-1.5 text-white rounded text-sm ml-auto mr-8 bg-gradient-to-l from-[#43A0EC] to-[#1777CB] transition-colors"
                style={{ boxShadow: '0 2px 4px 0 rgba(0,0,0,0.38)', border: 'none' }}
                title="새 직원 추가"
              >
                + 직원 추가
              </button>
            )}
          </div>
          <div className="bg-border h-px w-full mb-0" />
          {/* 로딩 중 메시지 */}
          {loading ? (
            <div className="text-center py-8">직원 데이터를 불러오는 중입니다...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-max" style={{ tableLayout: 'fixed' }}>
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b border-border px-1 py-2 text-center text-[13px] font-medium text-muted-foreground w-[100px] whitespace-nowrap">사번</th>
                  <th className="border-b border-border border-l border-border px-1 py-2 text-center text-[13px] font-medium text-muted-foreground w-[70px] whitespace-nowrap">이름</th>
                  <th className="border-b border-border border-l border-border px-1 py-2 text-center text-[13px] font-medium text-muted-foreground w-[70px] whitespace-nowrap">직급</th>
                  <th className="border-b border-border border-l border-border px-3 py-2 text-center text-[13px] font-medium text-muted-foreground w-[90px] whitespace-nowrap">부서</th>
                  <th className="border-b border-border border-l border-border px-3 py-2 text-center text-[13px] font-medium text-muted-foreground w-[120px] whitespace-nowrap">연락처</th>
                  <th className="border-b border-border border-l border-border px-3 py-2 text-center text-[13px] font-medium text-muted-foreground w-[200px] whitespace-nowrap">이메일</th>
                  <th className="border-b border-border border-l border-border px-3 py-2 text-center text-[13px] font-medium text-muted-foreground w-[80px] whitespace-nowrap">생성연차</th>
                <th className="border-b border-border border-l border-border px-3 py-2 text-center text-[13px] font-medium text-muted-foreground w-[80px] whitespace-nowrap">사용연차</th>
                <th className="border-b border-border border-l border-border px-3 py-2 text-center text-[13px] font-medium text-muted-foreground w-[80px] whitespace-nowrap">남은연차</th>
                  {/* 반응형: lg 이상에서만 표시되는 컬럼들 */}
                  <th className="border-b border-border border-l border-border px-3 py-2 text-center text-[13px] font-medium text-muted-foreground w-[100px] whitespace-nowrap hidden lg:table-cell">입사일</th>
                  <th className="border-b border-border border-l border-border px-3 py-2 text-center text-[13px] font-medium text-muted-foreground w-[100px] whitespace-nowrap hidden lg:table-cell">생년월일</th>
                  {isHRorAdmin && <>
                    <th className="border-b border-border border-l border-border px-3 py-2 text-center text-[13px] font-medium text-muted-foreground w-[80px] whitespace-nowrap hidden xl:table-cell">은행</th>
                    <th className="border-b border-border border-l border-border px-2 py-2 text-center text-[13px] font-medium text-muted-foreground w-[120px] whitespace-nowrap hidden xl:table-cell">계좌번호</th>
                    <th className="border-b border-border border-l border-border px-2 py-2 text-center text-[13px] font-medium text-muted-foreground w-[300px] whitespace-nowrap hidden 2xl:table-cell">주소</th>
                    <th className="border-b border-border border-l border-border px-2 py-2 text-center text-[13px] font-medium text-muted-foreground w-[80px] whitespace-nowrap">관리</th>
                  </>}
                </tr>
              </thead>
              <tbody>
                {/* 기존 직원 목록 */}
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td className="border-b border-border px-3 py-8 text-center text-muted-foreground" colSpan={isHRorAdmin ? 15 : 9}>
                      직원 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-muted/10 border-b border-border text-[13px]">
                      <td className="border-b border-border px-1 py-2 text-center text-foreground w-[100px] truncate">{emp.employeeID}</td>
                      
                      {/* 이름 - 편집 가능 */}
                      <td className="border-b border-border border-l border-border px-1 py-2 text-center text-foreground w-[70px] truncate">
                        {isEditing(emp) ? (
                          <input
                            type="text"
                            value={getEditValue(emp, 'name')}
                            onChange={(e) => updateEditValue('name', e.target.value)}
                            className="w-full text-[13px] border border-border rounded px-1 py-0.5 text-center"
                          />
                        ) : (
                          emp.name
                        )}
                      </td>
                      
                      {/* 직급 - 편집 가능 */}
                      <td className="border-b border-border border-l border-border px-1 py-2 text-center text-foreground w-[70px] truncate">
                        {isEditing(emp) ? (
                          <input
                            type="text"
                            value={getEditValue(emp, 'position')}
                            onChange={(e) => updateEditValue('position', e.target.value)}
                            className="w-full text-[13px] border border-border rounded px-1 py-0.5 text-center"
                          />
                        ) : (
                          emp.position
                        )}
                      </td>
                      
                      {/* 부서 - 편집 가능 */}
                      <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground w-[90px] truncate">
                        {isEditing(emp) ? (
                          <input
                            type="text"
                            value={getEditValue(emp, 'department')}
                            onChange={(e) => updateEditValue('department', e.target.value)}
                            className="w-full text-[13px] border border-border rounded px-1 py-0.5 text-center"
                          />
                        ) : (
                          emp.department
                        )}
                      </td>
                      
                      {/* 연락처 - 편집 가능 */}
                      <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground w-[120px] truncate">
                        {isEditing(emp) ? (
                          <input
                            type="text"
                            value={getEditValue(emp, 'phone')}
                            onChange={(e) => updateEditValue('phone', e.target.value)}
                            className="w-full text-[13px] border border-border rounded px-1 py-0.5 text-center"
                          />
                        ) : (
                          emp.phone
                        )}
                      </td>
                      
                      {/* 이메일 - 편집 가능 */}
                      <td className="border-b border-border border-l border-border px-3 py-2 text-left text-foreground w-[200px] truncate">
                        {isEditing(emp) ? (
                          <input
                            type="email"
                            value={getEditValue(emp, 'email')}
                            onChange={(e) => updateEditValue('email', e.target.value)}
                            className="w-full text-[13px] border border-border rounded px-1 py-0.5"
                          />
                        ) : (
                          emp.email
                        )}
                      </td>
                      
                      {/* 생성연차 - 편집 가능 */}
                      <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground w-[80px] truncate">
                        {isEditing(emp) ? (
                          <input
                            type="number"
                            step="0.5"
                            value={getEditValue(emp, 'annual_leave_granted_current_year')}
                            onChange={(e) => updateEditValue('annual_leave_granted_current_year', parseFloat(e.target.value) || 0)}
                            className="w-full text-[13px] border border-border rounded px-1 py-0.5 text-center"
                          />
                        ) : (
                          `${emp.annual_leave_granted_current_year || 0}일`
                        )}
                      </td>
                      
                      {/* 사용연차 - 읽기 전용 */}
                      <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground w-[80px] truncate">
                        <span className="text-blue-600 font-medium">
                          {emp.used_annual_leave ? `${emp.used_annual_leave}일` : '0일'}
                        </span>
                      </td>
                      
                      {/* 남은연차 - 읽기 전용 (자동 계산) */}
                      <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground w-[80px] truncate">
                        <span className={`font-medium ${
                          (emp.remaining_annual_leave || 0) <= 2 ? 'text-red-600' : 
                          (emp.remaining_annual_leave || 0) <= 5 ? 'text-orange-600' : 
                          'text-green-600'
                        }`}>
                          {emp.remaining_annual_leave ? `${emp.remaining_annual_leave}일` : '0일'}
                        </span>
                      </td>
                      
                      {/* 반응형: lg 이상에서만 표시되는 컬럼들 */}
                      <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground w-[100px] truncate hidden lg:table-cell">
                        {isEditing(emp) ? (
                          <input
                            type="date"
                            value={getEditValue(emp, 'join_date')}
                            onChange={(e) => updateEditValue('join_date', e.target.value)}
                            className="w-full text-[13px] border border-border rounded px-1 py-0.5 text-center"
                          />
                        ) : (
                          emp.join_date
                        )}
                      </td>
                      
                      <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground w-[100px] truncate hidden lg:table-cell">
                        {isEditing(emp) ? (
                          <input
                            type="date"
                            value={getEditValue(emp, 'birthday')}
                            onChange={(e) => updateEditValue('birthday', e.target.value)}
                            className="w-full text-[13px] border border-border rounded px-1 py-0.5 text-center"
                          />
                        ) : (
                          emp.birthday
                        )}
                      </td>
                      
                      {isHRorAdmin && <>
                        <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground w-[80px] truncate hidden xl:table-cell">
                          {isEditing(emp) ? (
                            <input
                              type="text"
                              value={getEditValue(emp, 'bank')}
                              onChange={(e) => updateEditValue('bank', e.target.value)}
                              className="w-full text-[13px] border border-border rounded px-1 py-0.5 text-center"
                            />
                          ) : (
                            emp.bank
                          )}
                        </td>
                        
                        <td className="border-b border-border border-l border-border px-2 py-2 text-left text-foreground w-[120px] truncate hidden xl:table-cell">
                          {isEditing(emp) ? (
                            <input
                              type="text"
                              value={getEditValue(emp, 'bank_account')}
                              onChange={(e) => updateEditValue('bank_account', e.target.value)}
                              className="w-full text-[13px] border border-border rounded px-1 py-0.5"
                            />
                          ) : (
                            emp.bank_account
                          )}
                        </td>
                        
                        <td className="border-b border-border border-l border-border px-2 py-2 text-left text-foreground w-[300px] truncate hidden 2xl:table-cell">
                          {isEditing(emp) ? (
                            <input
                              type="text"
                              value={getEditValue(emp, 'adress')}
                              onChange={(e) => updateEditValue('adress', e.target.value)}
                              className="w-full text-[13px] border border-border rounded px-1 py-0.5"
                            />
                          ) : (
                            emp.adress
                          )}
                        </td>
                        
                        {/* 관리 버튼 */}
                        <td className="border-b border-border border-l border-border px-2 py-2 text-center w-[80px] truncate">
                          {isEditing(emp) ? (
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={saveEditing}
                                className="px-2 py-1 text-[11px] bg-green-500 text-white rounded hover:bg-green-600"
                                title="저장"
                              >
                                저장
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="px-2 py-1 text-[11px] bg-gray-500 text-white rounded hover:bg-gray-600"
                                title="취소"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-1 justify-center">
                              {canEdit && (
                                <button
                                  onClick={() => startEditing(emp)}
                                  className="px-2 py-1 text-[11px] bg-blue-500 text-white rounded hover:bg-blue-600"
                                  title="수정"
                                >
                                  수정
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </>}
                    </tr>
                  ))
                )}
              </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 직원 추가 모달 */}
      {showAddEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/5" onClick={cancelAddingEmployee}>
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-0 relative" onClick={e => e.stopPropagation()}>
            <form onSubmit={saveNewEmployee} className="p-6 pt-4 space-y-6">
              <h3 className="text-lg font-bold mb-4">새 직원 추가</h3>
              
              {/* 에러 메시지 */}
              {addEmployeeError && (
                <div className="text-red-500 text-sm text-center mb-4">{addEmployeeError}</div>
              )}
              
              {/* 기본 정보 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                {/* 이름 - 필수 */}
                <div>
                  <label className="block font-semibold mb-1">이름 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="name"
                    value={addEmployeeForm.name || ''}
                    onChange={handleAddEmployeeFormChange}
                    className="w-full border rounded px-3 py-2"
                    placeholder="예: 홍길동"
                    required
                  />
                </div>
                
                {/* 이메일 - 필수 */}
                <div>
                  <label className="block font-semibold mb-1">이메일 <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    name="email"
                    value={addEmployeeForm.email || ''}
                    onChange={handleAddEmployeeFormChange}
                    className="w-full border rounded px-3 py-2"
                    placeholder="예: hong@hansl.com"
                    required
                  />
                </div>
                
                {/* 직급 */}
                <div>
                  <label className="block font-semibold mb-1">직급</label>
                  <input
                    type="text"
                    name="position"
                    value={addEmployeeForm.position || ''}
                    onChange={handleAddEmployeeFormChange}
                    className="w-full border rounded px-3 py-2"
                    placeholder="예: 과장"
                  />
                </div>
                
                {/* 부서 */}
                <div>
                  <label className="block font-semibold mb-1">부서</label>
                  <input
                    type="text"
                    name="department"
                    value={addEmployeeForm.department || ''}
                    onChange={handleAddEmployeeFormChange}
                    className="w-full border rounded px-3 py-2"
                    placeholder="예: 엔지니어링반"
                  />
                </div>
                
                {/* 연락처 */}
                <div>
                  <label className="block font-semibold mb-1">연락처</label>
                  <input
                    type="text"
                    name="phone"
                    value={addEmployeeForm.phone || ''}
                    onChange={handleAddEmployeeFormChange}
                    className="w-full border rounded px-3 py-2"
                    placeholder="예: 010-1234-5678"
                  />
                </div>
                
                {/* 생성연차 */}
                <div>
                  <label className="block font-semibold mb-1">생성연차 (0.5일 단위 가능)</label>
                  <input
                    type="number"
                    step="0.5"
                    name="annual_leave_granted_current_year"
                    value={addEmployeeForm.annual_leave_granted_current_year || 0}
                    onChange={handleAddEmployeeFormChange}
                    className="w-full border rounded px-3 py-2"
                    placeholder="예: 15 또는 15.5"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">💡 사용연차와 남은연차는 자동으로 계산됩니다</p>
                </div>
                
                {/* 입사일 */}
                <div>
                  <label className="block font-semibold mb-1">입사일</label>
                  <input
                    type="date"
                    name="join_date"
                    value={addEmployeeForm.join_date || ''}
                    onChange={handleAddEmployeeFormChange}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                
                {/* 생년월일 */}
                <div>
                  <label className="block font-semibold mb-1">생년월일</label>
                  <input
                    type="date"
                    name="birthday"
                    value={addEmployeeForm.birthday || ''}
                    onChange={handleAddEmployeeFormChange}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>
              
              {/* HR/Admin 전용 필드 */}
              {isHRorAdmin && (
                <div className="border-t pt-4">
                  <div className="font-semibold mb-3 text-gray-700">금융 정보 (HR/Admin 전용)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                    {/* 은행 */}
                    <div>
                      <label className="block font-semibold mb-1">은행</label>
                      <input
                        type="text"
                        name="bank"
                        value={addEmployeeForm.bank || ''}
                        onChange={handleAddEmployeeFormChange}
                        className="w-full border rounded px-3 py-2"
                        placeholder="예: 국민은행"
                      />
                    </div>
                    
                    {/* 계좌번호 */}
                    <div>
                      <label className="block font-semibold mb-1">계좌번호</label>
                      <input
                        type="text"
                        name="bank_account"
                        value={addEmployeeForm.bank_account || ''}
                        onChange={handleAddEmployeeFormChange}
                        className="w-full border rounded px-3 py-2"
                        placeholder="예: 123-45-678901"
                      />
                    </div>
                    
                    {/* 주소 */}
                    <div className="sm:col-span-2">
                      <label className="block font-semibold mb-1">주소</label>
                      <input
                        type="text"
                        name="adress"
                        value={addEmployeeForm.adress || ''}
                        onChange={handleAddEmployeeFormChange}
                        className="w-full border rounded px-3 py-2"
                        placeholder="예: 서울시 강남구 테헤란로 123"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {/* 저장/취소 버튼 */}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="w-1/2 px-3 py-2 bg-gradient-to-l from-[#43A0EC] to-[#1777CB] text-white rounded text-base transition-colors"
                  style={{ boxShadow: '0 2px 4px 0 rgba(0,0,0,0.38)', border: 'none' }}
                  disabled={addEmployeeLoading}
                >
                  {addEmployeeLoading ? '저장 중...' : '저장'}
                </button>
                <button
                  type="button"
                  className="w-1/2 px-3 py-2 bg-gradient-to-l from-[#7D8590] to-[#6E6E73] text-white rounded text-base transition-colors"
                  style={{ boxShadow: '0 2px 4px 0 rgba(0,0,0,0.38)', border: 'none' }}
                  onClick={cancelAddingEmployee}
                  disabled={addEmployeeLoading}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}