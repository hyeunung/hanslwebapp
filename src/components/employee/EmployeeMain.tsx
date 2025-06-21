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
  hire_date?: string;
}

// 간단한 모달 컴포넌트 (업체관리와 동일)
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/5" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export default function EmployeeMain() {
  // 직원 목록 상태
  const [employees, setEmployees] = useState<Employee[]>([]);
  // 로딩 상태
  const [loading, setLoading] = useState(true);
  // 검색어 상태
  const [searchTerm, setSearchTerm] = useState("");
  const { currentUserRole } = usePurchaseData();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("employees")
      .select("id, employeeID, name, email, phone, position, department, join_date, birthday, bank, bank_account, adress, hire_date");
    if (!error && data) setEmployees(data);
    setLoading(false);
  };

  // 직원 삭제 핸들러
  const handleDelete = async (id: string) => {
    if (!window.confirm("정말로 이 직원을 삭제하시겠습니까?")) return;
    setLoading(true);
    await supabase.from("employees").delete().eq("id", id);
    await fetchAll();
    setLoading(false);
  };

  // 검색 필터
  const filteredEmployees = employees.filter(emp => {
    const text = [emp.employeeID, emp.name, emp.email, emp.phone, emp.position, emp.department, emp.join_date, emp.birthday, emp.bank, emp.bank_account, emp.adress, emp.hire_date].join(" ").toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  // role이 hr, admin이 아니면 제한된 컬럼만 보여줌
  const isHRorAdmin = currentUserRole === 'hr' || currentUserRole === 'admin';
  // 박스 최대 가로폭 조건부 스타일
  const boxMaxWidth = isHRorAdmin ? '1400px' : '900px';

  return (
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
        {/* 검색 input만 남기고 직원 추가 버튼 삭제 */}
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
        </div>
        <div className="bg-border h-px w-full mb-0" />
        {/* 로딩 중 메시지 */}
        {loading ? (
          <div className="text-center py-8">직원 데이터를 불러오는 중입니다...</div>
        ) : (
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-gray-50">
              <tr>
                <th className="border-b border-border px-1 py-2 text-center text-[13px] font-medium text-muted-foreground min-w-0 w-[100px] max-w-[160px] truncate">사번</th>
                <th className="border-b border-border border-l border-border px-1 py-2 text-center text-[13px] font-medium text-muted-foreground min-w-0 w-[70px] max-w-[90px] truncate">이름</th>
                <th className="border-b border-border border-l border-border px-1 py-2 text-center text-[13px] font-medium text-muted-foreground min-w-0 w-[70px] max-w-[90px] truncate">직급</th>
                <th className="border-b border-border border-l border-border px-3 py-2 text-center text-[13px] font-medium text-muted-foreground min-w-0 w-[90px] max-w-[100px] truncate">부서</th>
                <th className="border-b border-border border-l border-border px-3 py-2 text-center text-[13px] font-medium text-muted-foreground min-w-0 w-[150px] max-w-[140px] truncate">연락처</th>
                <th className="border-b border-border border-l border-border px-3 py-2 text-center text-[13px] font-medium text-muted-foreground min-w-0 w-[220px] max-w-[320px] break-all">이메일</th>
                {isHRorAdmin && <>
                  <th className="border-b border-border border-l border-border px-3 py-2 text-center text-[13px] font-medium text-muted-foreground min-w-0 w-[120px] max-w-[160px] truncate">입사일</th>
                  <th className="border-b border-border border-l border-border px-3 py-2 text-center text-[13px] font-medium text-muted-foreground min-w-0 w-[120px] max-w-[160px] truncate">생년월일</th>
                  <th className="border-b border-border border-l border-border px-3 py-2 text-center text-[13px] font-medium text-muted-foreground min-w-0 w-[100px] max-w-[180px] truncate">은행</th>
                  <th className="border-b border-border border-l border-border px-2 py-2 text-center text-[13px] font-medium text-muted-foreground min-w-0 w-[130px] max-w-[200px] truncate">계좌번호</th>
                  <th className="border-b border-border border-l border-border px-2 py-2 text-center text-[13px] font-medium text-muted-foreground min-w-0 w-[550px] max-w-[700px] truncate">주소</th>
                  <th className="border-b border-border border-l border-border px-2 py-2 text-center text-[13px] font-medium text-muted-foreground min-w-0 w-[110px] max-w-[220px] truncate">관리</th>
                </>}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td className="border-b border-border px-3 py-8 text-center text-muted-foreground" colSpan={isHRorAdmin ? 13 : 6}>
                    직원 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-muted/10 border-b border-border text-[13px]">
                    <td className="border-b border-border px-1 py-2 text-center text-foreground min-w-0 w-[100px] max-w-[160px] truncate">{emp.employeeID}</td>
                    <td className="border-b border-border border-l border-border px-1 py-2 text-center text-foreground min-w-0 w-[70px] max-w-[90px] truncate">{emp.name}</td>
                    <td className="border-b border-border border-l border-border px-1 py-2 text-center text-foreground min-w-0 w-[70px] max-w-[90px] truncate">{emp.position}</td>
                    <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground min-w-0 w-[90px] max-w-[100px] truncate">{emp.department}</td>
                    <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground min-w-0 w-[150px] max-w-[140px] truncate">{emp.phone}</td>
                    <td className="border-b border-border border-l border-border px-3 py-2 text-left text-foreground min-w-0 w-[220px] max-w-[320px] break-all">{emp.email}</td>
                    {isHRorAdmin && <>
                      <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground min-w-0 w-[120px] max-w-[160px] truncate">{emp.join_date}</td>
                      <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground min-w-0 w-[120px] max-w-[160px] truncate">{emp.birthday}</td>
                      <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground min-w-0 w-[100px] max-w-[180px] truncate">{emp.bank}</td>
                      <td className="border-b border-border border-l border-border px-2 py-2 text-left text-foreground min-w-0 w-[130px] max-w-[200px] truncate">{emp.bank_account}</td>
                      <td className="border-b border-border border-l border-border px-2 py-2 text-left text-foreground min-w-0 w-[550px] max-w-[700px] truncate">{emp.adress}</td>
                      <td className="border-b border-border border-l border-border px-2 py-2 text-center min-w-0 w-[110px] max-w-[220px] truncate"></td>
                    </>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
} 