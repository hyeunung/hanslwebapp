import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// 업체(벤더)와 담당자 데이터 타입 정의
interface Vendor {
  id: number;
  vendor_name: string;
  vendor_phone?: string;
  vendor_fax?: string;
  vendor_payment_schedule?: string;
}

interface VendorContact {
  id: number;
  vendor_id: number;
  contact_name: string;
  contact_phone?: string;
  contact_email?: string;
  position?: string;
}

// 간단한 모달 컴포넌트 (포커스/esc 등은 미구현, 뼈대만)
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

// 업체(벤더) 관리 메인 컴포넌트입니다.
// 이 컴포넌트는 업체 목록을 표(테이블) 형태로 보여줍니다.
// supabase에서 vendors, vendor_contacts 데이터를 불러와서 표시합니다.
export default function VendorListMain() {
  // 업체 목록 상태
  const [vendors, setVendors] = useState<Vendor[]>([]);
  // 담당자 목록 상태
  const [contacts, setContacts] = useState<VendorContact[]>([]);
  // 로딩 상태
  const [loading, setLoading] = useState(true);
  // 담당자 모달 상태: 열려있는지 여부와 어떤 업체인지
  const [modalVendorId, setModalVendorId] = useState<number | null>(null);
  // 담당자 추가 폼 상태
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    contact_name: '',
    position: '',
    contact_phone: '',
    contact_email: '',
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  // 담당자 인라인 수정 상태: contact id와 입력값
  const [editContactId, setEditContactId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    contact_name: '',
    position: '',
    contact_phone: '',
    contact_email: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  // 업체 인라인 수정 상태: vendor id와 입력값
  const [editVendorId, setEditVendorId] = useState<number | null>(null);
  const [editVendorForm, setEditVendorForm] = useState({
    vendor_name: '',
    vendor_phone: '',
    vendor_fax: '',
    vendor_payment_schedule: '',
  });
  const [editVendorLoading, setEditVendorLoading] = useState(false);
  const [editVendorError, setEditVendorError] = useState<string | null>(null);
  // 업체 추가 모달 상태
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  // 업체+담당자 추가 폼 상태 (모달용)
  const [addVendorForm, setAddVendorForm] = useState({
    vendor_name: '',
    vendor_phone: '',
    vendor_fax: '',
    vendor_payment_schedule: '',
  });
  // 담당자 여러 명 입력을 위한 배열 상태
  const [addContacts, setAddContacts] = useState([
    { contact_name: '', position: '', contact_phone: '', contact_email: '' }
  ]);
  const [addVendorLoading, setAddVendorLoading] = useState(false);
  const [addVendorError, setAddVendorError] = useState<string | null>(null);
  // 검색어 상태
  const [searchTerm, setSearchTerm] = useState('');

  // 컴포넌트가 처음 마운트될 때 supabase에서 데이터 불러오기
  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 데이터 새로고침 함수
  const fetchAll = async () => {
    setLoading(true);
    // vendors 테이블에서 업체 목록 불러오기
    const { data: vendorData, error: vendorError } = await supabase
      .from("vendors")
      .select("id, vendor_name, vendor_phone, vendor_fax, vendor_payment_schedule");
    // vendor_contacts 테이블에서 담당자 목록 불러오기
    const { data: contactData, error: contactError } = await supabase
      .from("vendor_contacts")
      .select("id, vendor_id, contact_name, contact_phone, contact_email, position");
    if (!vendorError && vendorData) setVendors(vendorData);
    if (!contactError && contactData) setContacts(contactData);
    setLoading(false);
  };

  // 각 업체의 대표 담당자(가장 먼저 등록된 contact)를 찾는 함수
  const getMainContact = (vendorId: number) => {
    // 해당 업체의 모든 담당자 중 첫 번째(가장 먼저 등록된) 담당자를 대표로 사용
    const vendorContacts = contacts.filter(c => c.vendor_id === vendorId);
    return vendorContacts.length > 0 ? vendorContacts[0] : null;
  };

  // 특정 업체의 모든 담당자 목록을 반환하는 함수
  const getContactsForVendor = (vendorId: number) => {
    return contacts.filter(c => c.vendor_id === vendorId);
  };

  // 모달 닫기 핸들러
  const closeModal = () => {
    setModalVendorId(null);
    setShowAddForm(false);
    setAddForm({ contact_name: '', position: '', contact_phone: '', contact_email: '' });
    setAddError(null);
  };

  // 모달에 표시할 업체 정보와 담당자 목록
  const modalVendor = vendors.find(v => v.id === modalVendorId) || null;
  const modalContacts = modalVendorId ? getContactsForVendor(modalVendorId) : [];

  // 담당자 추가 폼 입력값 변경 핸들러
  const handleAddFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAddForm(prev => ({ ...prev, [name]: value }));
  };

  // 담당자 추가 폼 제출 핸들러
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalVendorId) return;
    if (!addForm.contact_name.trim()) {
      setAddError('이름을 입력해 주세요.');
      return;
    }
    if (addForm.contact_email && addForm.contact_email.includes('@hansl.com')) {
      setAddError('한슬 직원 이메일은 업체 담당자로 등록할 수 없습니다.');
      return;
    }
    setAddLoading(true);
    setAddError(null);
    // supabase에 새 담당자 추가
    const { error } = await supabase.from('vendor_contacts').insert([
      {
        vendor_id: modalVendorId,
        contact_name: addForm.contact_name,
        position: addForm.position,
        contact_phone: addForm.contact_phone,
        contact_email: addForm.contact_email,
      }
    ]);
    if (error) {
      setAddError('담당자 추가에 실패했습니다.');
    } else {
      // 성공 시 폼 초기화, 폼 닫기, 데이터 새로고침
      setAddForm({ contact_name: '', position: '', contact_phone: '', contact_email: '' });
      setShowAddForm(false);
      await fetchAll();
    }
    setAddLoading(false);
  };

  // 수정 버튼 클릭 시 해당 담당자 정보를 editForm에 세팅하고 편집 모드 진입
  const handleEditClick = (c: VendorContact) => {
    setEditContactId(c.id);
    setEditForm({
      contact_name: c.contact_name || '',
      position: c.position || '',
      contact_phone: c.contact_phone || '',
      contact_email: c.contact_email || '',
    });
    setEditError(null);
  };

  // 인라인 수정 입력값 변경 핸들러
  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  // 인라인 수정 저장 핸들러
  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editContactId) return;
    if (!editForm.contact_name.trim()) {
      setEditError('이름을 입력해 주세요.');
      return;
    }
    if (editForm.contact_email && editForm.contact_email.includes('@hansl.com')) {
      setEditError('한슬 직원 이메일은 업체 담당자로 등록할 수 없습니다.');
      return;
    }
    setEditLoading(true);
    setEditError(null);
    // supabase에 업데이트
    const { error } = await supabase.from('vendor_contacts').update({
      contact_name: editForm.contact_name,
      position: editForm.position,
      contact_phone: editForm.contact_phone,
      contact_email: editForm.contact_email,
    }).eq('id', editContactId);
    if (error) {
      setEditError('수정에 실패했습니다.');
    } else {
      setEditContactId(null);
      await fetchAll();
    }
    setEditLoading(false);
  };

  // 인라인 수정 취소 핸들러
  const handleEditCancel = () => {
    setEditContactId(null);
    setEditError(null);
  };

  // 업체 수정 버튼 클릭 시 해당 업체 정보를 editVendorForm에 세팅하고 편집 모드 진입
  const handleVendorEditClick = (v: Vendor) => {
    setEditVendorId(v.id);
    setEditVendorForm({
      vendor_name: v.vendor_name || '',
      vendor_phone: v.vendor_phone || '',
      vendor_fax: v.vendor_fax || '',
      vendor_payment_schedule: v.vendor_payment_schedule || '',
    });
    setEditVendorError(null);
  };

  // 업체 인라인 수정 입력값 변경 핸들러
  const handleVendorEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditVendorForm(prev => ({ ...prev, [name]: value }));
  };

  // 업체 인라인 수정 저장 핸들러
  const handleVendorEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVendorId) return;
    if (!editVendorForm.vendor_name.trim()) {
      setEditVendorError('업체명을 입력해 주세요.');
      return;
    }
    setEditVendorLoading(true);
    setEditVendorError(null);
    // supabase에 업데이트
    const { error } = await supabase.from('vendors').update({
      vendor_name: editVendorForm.vendor_name,
      vendor_phone: editVendorForm.vendor_phone,
      vendor_fax: editVendorForm.vendor_fax,
      vendor_payment_schedule: editVendorForm.vendor_payment_schedule,
    }).eq('id', editVendorId);
    if (error) {
      setEditVendorError('수정에 실패했습니다.');
    } else {
      setEditVendorId(null);
      await fetchAll();
    }
    setEditVendorLoading(false);
  };

  // 업체 인라인 수정 취소 핸들러
  const handleVendorEditCancel = () => {
    setEditVendorId(null);
    setEditVendorError(null);
  };

  // 업체 삭제 핸들러 (담당자, 발주 등 참조 row도 함께 삭제)
  const handleVendorDelete = async (vendorId: number) => {
    if (!window.confirm('정말로 이 업체를 삭제하시겠습니까? 관련 담당자 및 관련 발주도 모두 삭제됩니다.')) return;
    setLoading(true);
    // 1. vendor_contacts(담당자) 먼저 삭제
    await supabase.from('vendor_contacts').delete().eq('vendor_id', vendorId);
    // 2. purchase_requests(발주)에서 해당 업체 참조 row 삭제
    await supabase.from('purchase_requests').delete().eq('vendor_id', vendorId);
    // 3. vendors(업체) 삭제
    await supabase.from('vendors').delete().eq('id', vendorId);
    await fetchAll();
    setLoading(false);
  };

  // 업체 입력값 변경 핸들러
  const handleAddVendorFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAddVendorForm((prev) => ({ ...prev, [name]: value }));
  };
  // 담당자 입력값 변경 핸들러 (index별)
  const handleAddContactChange = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAddContacts((prev) => prev.map((c, i) => i === idx ? { ...c, [name]: value } : c));
  };
  // 담당자 추가 버튼 클릭 시
  const handleAddContactAdd = () => {
    setAddContacts((prev) => [...prev, { contact_name: '', position: '', contact_phone: '', contact_email: '' }]);
  };
  // 담당자 삭제 버튼 클릭 시
  const handleAddContactRemove = (idx: number) => {
    if (addContacts.length <= 1) return; // 최소 1명 보장
    setAddContacts((prev) => prev.filter((_, i) => i !== idx));
  };
  // 저장 버튼 클릭 시
  const handleAddVendorSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddVendorError(null);
    if (!addVendorForm.vendor_name.trim()) {
      setAddVendorError('업체명을 입력해 주세요.');
      return;
    }
    if (addContacts.some(c => !c.contact_name.trim())) {
      setAddVendorError('모든 담당자 이름을 입력해 주세요.');
      return;
    }
    if (addContacts.some(c => c.contact_email && c.contact_email.includes('@hansl.com'))) {
      setAddVendorError('한슬 직원 이메일은 업체 담당자로 등록할 수 없습니다.');
      return;
    }
    setAddVendorLoading(true);
    // 1. 업체(vendors) insert
    const { data: vendorData, error: vendorError } = await supabase.from('vendors').insert([
      addVendorForm
    ]).select('id').single();
    if (vendorError || !vendorData) {
      setAddVendorError('업체 저장에 실패했습니다.');
      setAddVendorLoading(false);
      return;
    }
    // 2. 담당자(vendor_contacts) 여러 명 insert
    const contactsToInsert = addContacts.map(c => ({ ...c, vendor_id: vendorData.id }));
    const { error: contactError } = await supabase.from('vendor_contacts').insert(contactsToInsert);
    if (contactError) {
      setAddVendorError('담당자 저장에 실패했습니다.');
      setAddVendorLoading(false);
      return;
    }
    // 성공: 모달 닫고 목록 새로고침
    setShowAddVendorModal(false);
    setAddVendorForm({ vendor_name: '', vendor_phone: '', vendor_fax: '', vendor_payment_schedule: '' });
    setAddContacts([{ contact_name: '', position: '', contact_phone: '', contact_email: '' }]);
    await fetchAll();
    setAddVendorLoading(false);
  };
  // 취소 버튼 클릭 시
  const handleAddVendorCancel = () => {
    setShowAddVendorModal(false);
    setAddVendorForm({ vendor_name: '', vendor_phone: '', vendor_fax: '', vendor_payment_schedule: '' });
    setAddContacts([{ contact_name: '', position: '', contact_phone: '', contact_email: '' }]);
    setAddVendorError(null);
  };

  // 검색어로 필터링된 업체 목록 계산
  const filteredVendors = vendors.filter(vendor => {
    // 업체명, 전화번호, 팩스번호, 결제방식, 담당자명, 담당자 연락처, 담당자 이메일 모두 포함
    const vendorText = [
      vendor.vendor_name,
      vendor.vendor_phone,
      vendor.vendor_fax,
      vendor.vendor_payment_schedule,
      ...contacts.filter(c => c.vendor_id === vendor.id).map(c => [c.contact_name, c.contact_phone, c.contact_email, c.position]).flat()
    ].join(' ').toLowerCase();
    return vendorText.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="bg-white rounded-lg shadow-lg p-0 border border-border w-full">
      {/* 상단 헤더: 컬러 포인트, 제목, 부제목, + 업체 추가 버튼 */}
      <div className="pt-[16px] pb-0 px-0 flex items-center justify-between">
        <div className="relative flex gap-2 min-h-0 mt-1 pl-12" style={{ alignItems: 'flex-start', paddingTop: 0, paddingBottom: 0 }}>
          {/* 노랑색 세로 바 (오른쪽으로 이동, 길이 더 늘림) */}
          <div style={{ position: 'absolute', left: 30, top: 5, bottom: 0, width: '4px', borderRadius: '6px', background: '#FFD600' }} />
          <div className="flex flex-col gap-1 min-h-0">
            <h2 className="font-semibold text-foreground text-[19px] mb-0">
              업체관리
              <span className="text-muted-foreground text-[14px] font-normal ml-2 align-middle">총 {filteredVendors.length}개</span>
            </h2>
            <p className="text-muted-foreground text-[12.3px] font-normal mt-0 mb-0" style={{marginTop:'-2px',marginBottom:'-4px'}}>Vendor Management</p>
          </div>
        </div>
      </div>
      {/* 구분선(컬러 바): 제목/부제목 바로 아래, 여백 최소화 */}
      <hr className="border-t border-border mt-6 mb-2" />
      <div className="p-0">
        {/* 검색 input: 카드와 동일한 R값(rounded-lg), 돋보기 아이콘, 크기 키움 */}
        <div className="flex items-center gap-1 mb-3 mt-10 pl-8">
          <div className="relative w-full max-w-[400px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {/* SVG 돋보기 아이콘 */}
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" />
              </svg>
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="검색(업체명/담당자명/연락처 등)"
              className="w-full h-8 text-[13px] border border-border rounded-lg bg-white shadow-none pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <button
            className="px-3 py-1.5 text-white rounded text-sm ml-auto mr-8 bg-gradient-to-l from-[#43A0EC] to-[#1777CB] transition-colors"
            style={{ boxShadow: '0 2px 4px 0 rgba(0,0,0,0.38)', border: 'none' }}
            onClick={() => setShowAddVendorModal(true)}
          >
            + 업체 추가
          </button>
        </div>
        {/* 구분선: 카드 끝까지 이어지게, 여백 없이 */}
        <div className="bg-border h-px w-full mb-0" />
        {/* 로딩 중일 때 메시지 */}
        {loading ? (
          <div className="text-center py-8">업체 데이터를 불러오는 중입니다...</div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="border-b border-border px-3 py-2 !py-2 text-center text-[13px] font-medium text-muted-foreground">업체명</th>
                <th className="border-b border-border border-l border-border px-3 py-2 !py-2 text-center text-[13px] font-medium text-muted-foreground">전화번호</th>
                <th className="border-b border-border border-l border-border px-3 py-2 !py-2 text-center text-[13px] font-medium text-muted-foreground">팩스번호</th>
                <th className="border-b border-border border-l border-border px-3 py-2 !py-2 text-center text-[13px] font-medium text-muted-foreground">담당자</th>
                <th className="border-b border-border border-l border-border px-3 py-2 !py-2 text-center text-[13px] font-medium text-muted-foreground">결제 방식</th>
                <th className="border-b border-border border-l border-border px-3 py-2 !py-2 text-center text-[13px] font-medium text-muted-foreground">관리</th>
              </tr>
            </thead>
            <tbody>
              {/* 업체 데이터가 없을 때 안내 메시지 */}
              {filteredVendors.length === 0 ? (
                <tr>
                  <td className="border-b border-border px-3 py-8 text-center text-muted-foreground" colSpan={6}>
                    업체 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredVendors.map((vendor) => {
                  // 대표 담당자 정보 가져오기
                  const mainContact = getMainContact(vendor.id);
                  // 업체 인라인 수정 모드 분기
                  if (editVendorId === vendor.id) {
                    return (
                      <tr key={vendor.id} className="hover:bg-muted/10 border-b border-border text-[13px]">
                        <td className="border-b border-border px-3 py-2 text-center text-foreground">{vendor.vendor_name}</td>
                        <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground">{vendor.vendor_phone || '-'}</td>
                        <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground">{vendor.vendor_fax || '-'}</td>
                        <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground">
                          <div className="flex flex-row items-center justify-between gap-2">
                            <div className="flex flex-col items-start gap-1">
                              {mainContact ? (
                                <>
                                  <span>{mainContact.contact_name} {mainContact.position ? `(${mainContact.position})` : ''}</span>
                                  <span className="text-xs text-muted-foreground">{mainContact.contact_phone || ''}</span>
                                  <span className="text-xs text-muted-foreground">{mainContact.contact_email || ''}</span>
                                </>
                              ) : (
                                '-'
                              )}
                            </div>
                            <button
                              className="text-primary text-xs font-medium ml-2 hover:underline bg-transparent p-0 border-0 shadow-none"
                              onClick={() => setModalVendorId(vendor.id)}
                              title="담당자 관리"
                              type="button"
                            >
                              +추가/수정
                            </button>
                          </div>
                        </td>
                        <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground">
                          <input
                            type="text"
                            name="vendor_payment_schedule"
                            value={editVendorForm.vendor_payment_schedule}
                            onChange={handleVendorEditFormChange}
                            className="w-full border px-1 py-0.5 rounded text-xs bg-white"
                          />
                        </td>
                        <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground">
                          <form onSubmit={handleVendorEditSave} className="flex flex-row gap-1 items-center justify-center">
                            <button
                              type="submit"
                              className="px-2 py-1 bg-gradient-to-l from-[#43A0EC] to-[#1777CB] text-white rounded text-xs transition-colors"
                              style={{ boxShadow: '0 2px 4px 0 rgba(0,0,0,0.38)', border: 'none' }}
                              disabled={editVendorLoading}
                            >
                              저장
                            </button>
                            <button
                              type="button"
                              className="px-2 py-1 bg-gradient-to-l from-[#43A0EC] to-[#1777CB] text-white rounded text-xs transition-colors"
                              style={{ boxShadow: '0 2px 4px 0 rgba(0,0,0,0.38)', border: 'none' }}
                              onClick={handleVendorEditCancel}
                              disabled={editVendorLoading}
                            >
                              취소
                            </button>
                          </form>
                          {editVendorError && <div className="text-xs text-red-500 mt-1">{editVendorError}</div>}
                        </td>
                      </tr>
                    );
                  }
                  // 일반(비수정) 모드
                  return (
                    <tr key={vendor.id} className="hover:bg-muted/10 border-b border-border text-[13px]">
                      <td className="border-b border-border px-3 py-2 text-center text-foreground">{vendor.vendor_name}</td>
                      <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground">{vendor.vendor_phone || '-'}</td>
                      <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground">{vendor.vendor_fax || '-'}</td>
                      <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground">
                        <div className="flex flex-row items-center justify-between gap-2">
                          <div className="flex flex-col items-start gap-1">
                            {mainContact ? (
                              <>
                                <span>{mainContact.contact_name} {mainContact.position ? `(${mainContact.position})` : ''}</span>
                                <span className="text-xs text-muted-foreground">{mainContact.contact_phone || ''}</span>
                                <span className="text-xs text-muted-foreground">{mainContact.contact_email || ''}</span>
                              </>
                            ) : (
                              '-'
                            )}
                          </div>
                          <button
                            className="text-primary text-xs font-medium ml-2 hover:underline bg-transparent p-0 border-0 shadow-none"
                            onClick={() => setModalVendorId(vendor.id)}
                            title="담당자 관리"
                            type="button"
                          >
                            +추가/수정
                          </button>
                        </div>
                      </td>
                      <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground">{vendor.vendor_payment_schedule || '-'}</td>
                      <td className="border-b border-border border-l border-border px-3 py-2 text-center text-foreground">
                        {/* 관리(수정/삭제) 버튼들만 남김 */}
                        <div className="flex flex-row gap-2 justify-center">
                          {/* 수정 버튼 */}
                          <button
                            className="px-2 py-1 bg-gradient-to-l from-[#43A0EC] to-[#1777CB] text-white rounded text-xs transition-colors"
                            style={{ boxShadow: '0 2px 4px 0 rgba(0,0,0,0.38)', border: 'none' }}
                            onClick={() => handleVendorEditClick(vendor)}
                            title="업체 정보 수정"
                          >
                            수정
                          </button>
                          {/* 삭제 버튼 */}
                          <button
                            className="px-2 py-1 bg-gradient-to-l from-[#F36B7F] to-[#D70015] text-white rounded text-xs transition-colors"
                            style={{ boxShadow: '0 2px 4px 0 rgba(0,0,0,0.38)', border: 'none' }}
                            onClick={() => handleVendorDelete(vendor.id)}
                            title="업체 삭제"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {/* 담당자 관리 모달: 업체별 담당자 전체 목록을 보여줍니다. */}
        <Modal
          open={modalVendorId !== null}
          onClose={closeModal}
          title={modalVendor ? `${modalVendor.vendor_name} - 담당자 목록` : '담당자 목록'}
        >
          {/* 담당자 목록이 없으면 안내 메시지 */}
          {modalContacts.length === 0 ? (
            <div className="text-center text-gray-500 py-4">등록된 담당자가 없습니다.</div>
          ) : (
            <table className="w-full border-collapse mb-2">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-2 py-1 text-xs">이름</th>
                  <th className="border px-2 py-1 text-xs">직급</th>
                  <th className="border px-2 py-1 text-xs">연락처</th>
                  <th className="border px-2 py-1 text-xs">이메일</th>
                  <th className="border px-2 py-1 text-xs">관리</th>
                </tr>
              </thead>
              <tbody>
                {modalContacts.map((c) => (
                  <tr key={c.id}>
                    {/* 인라인 수정 모드일 때와 아닐 때 분기 */}
                    {editContactId === c.id ? (
                      <>
                        <td className="border px-2 py-1 text-xs text-center">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-2">
                            <div>
                              <label className="block text-xs mb-1">이름<span className="text-red-500">*</span></label>
                              <input
                                type="text"
                                name="contact_name"
                                value={editForm.contact_name}
                                onChange={handleEditFormChange}
                                className="w-full border px-2 py-1 rounded text-xs bg-white"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs mb-1">연락처</label>
                              <input
                                type="text"
                                name="contact_phone"
                                value={editForm.contact_phone}
                                onChange={handleEditFormChange}
                                className="w-full border px-2 py-1 rounded text-xs bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs mb-1">직급</label>
                              <input
                                type="text"
                                name="position"
                                value={editForm.position}
                                onChange={handleEditFormChange}
                                className="w-full border px-2 py-1 rounded text-xs bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs mb-1">이메일</label>
                              <input
                                type="email"
                                name="contact_email"
                                value={editForm.contact_email}
                                onChange={handleEditFormChange}
                                className="w-full border px-2 py-1 rounded text-xs bg-white"
                              />
                              {editForm.contact_email?.includes('@hansl.com') && (
                                <div className="text-red-500 text-xs mt-1">⚠️ 한슬 직원 이메일은 업체 담당자로 등록할 수 없습니다</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="border px-2 py-1 text-xs text-center">
                          <div className="flex gap-2 mt-4">
                            <button
                              type="submit"
                              className="w-1/2 px-3 py-1.5 bg-gradient-to-l from-[#43A0EC] to-[#1777CB] text-white rounded text-xs transition-colors"
                              style={{ boxShadow: '0 2px 4px 0 rgba(0,0,0,0.38)', border: 'none' }}
                              disabled={editLoading}
                            >
                              {editLoading ? '수정 중...' : '수정하기'}
                            </button>
                            <button
                              type="button"
                              className="w-1/2 px-3 py-1.5 bg-gradient-to-l from-[#7D8590] to-[#6E6E73] text-white rounded text-xs transition-colors"
                              style={{ boxShadow: '0 2px 4px 0 rgba(0,0,0,0.38)', border: 'none' }}
                              onClick={handleEditCancel}
                              disabled={editLoading}
                            >
                              취소
                            </button>
                          </div>
                          {editError && <div className="text-xs text-red-500 mt-1">{editError}</div>}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="border px-2 py-1 text-xs text-center">{c.contact_name}</td>
                        <td className="border px-2 py-1 text-xs text-center">{c.position || '-'}</td>
                        <td className="border px-2 py-1 text-xs text-center">{c.contact_phone || '-'}</td>
                        <td className="border px-2 py-1 text-xs text-center">{c.contact_email || '-'}</td>
                        <td className="border px-2 py-1 text-xs text-center">
                          {/* 수정 버튼 */}
                          <button
                            className="px-2 py-1 bg-gradient-to-l from-[#43A0EC] to-[#1777CB] text-white rounded text-xs transition-colors mr-1"
                            onClick={() => handleEditClick(c)}
                            title="담당자 수정"
                          >
                            수정
                          </button>
                          {/* 삭제 버튼 */}
                          <button
                            className="px-2 py-1 bg-gradient-to-l from-[#F36B7F] to-[#D70015] text-white rounded text-xs transition-colors"
                            style={{ boxShadow: '0 2px 4px 0 rgba(0,0,0,0.38)', border: 'none' }}
                            onClick={async () => {
                              if (!window.confirm('정말로 이 담당자를 삭제하시겠습니까?')) return;
                              // supabase에서 해당 담당자 삭제
                              await supabase.from('vendor_contacts').delete().eq('id', c.id);
                              // 삭제 후 목록 새로고침
                              await fetchAll();
                            }}
                            title="담당자 삭제"
                          >
                            삭제
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {/* 담당자 추가 폼 토글 버튼 */}
          <div className="text-right mb-2">
            {!showAddForm ? (
              <button
                className="px-3 py-1.5 bg-gradient-to-l from-[#43A0EC] to-[#1777CB] text-white rounded text-xs transition-colors"
                style={{ boxShadow: '0 2px 4px 0 rgba(0,0,0,0.38)', border: 'none' }}
                onClick={() => setShowAddForm(true)}
              >
                담당자 추가
              </button>
            ) : null}
          </div>
          {/* 담당자 추가 폼 */}
          {showAddForm && (
            <form onSubmit={handleAddContact} className="mb-2 bg-gray-50 p-3 rounded">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-2">
                <div>
                  <label className="block text-xs mb-1">이름<span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="contact_name"
                    value={addForm.contact_name}
                    onChange={handleAddFormChange}
                    className="w-full border px-2 py-1 rounded text-xs bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">연락처</label>
                  <input
                    type="text"
                    name="contact_phone"
                    value={addForm.contact_phone}
                    onChange={handleAddFormChange}
                    className="w-full border px-2 py-1 rounded text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">직급</label>
                  <input
                    type="text"
                    name="position"
                    value={addForm.position}
                    onChange={handleAddFormChange}
                    className="w-full border px-2 py-1 rounded text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">이메일</label>
                  <input
                    type="email"
                    name="contact_email"
                    value={addForm.contact_email}
                    onChange={handleAddFormChange}
                    className="w-full border px-2 py-1 rounded text-xs bg-white"
                    placeholder="예: contact@supplier.co.kr"
                  />
                  {addForm.contact_email?.includes('@hansl.com') && (
                    <div className="text-red-500 text-xs mt-1">⚠️ 한슬 직원 이메일은 업체 담당자로 등록할 수 없습니다</div>
                  )}
                </div>
              </div>
              {addError && <div className="text-xs text-red-500 mb-2">{addError}</div>}
              <div className="flex gap-2 mt-4">
                <button
                  type="submit"
                  className="w-1/2 px-3 py-1.5 bg-gradient-to-l from-[#43A0EC] to-[#1777CB] text-white rounded text-xs transition-colors"
                  style={{ boxShadow: '0 2px 4px 0 rgba(0,0,0,0.38)', border: 'none' }}
                  disabled={addLoading}
                >
                  {addLoading ? '추가 중...' : '추가하기'}
                </button>
                <button
                  type="button"
                  className="w-1/2 px-3 py-1.5 bg-gradient-to-l from-[#7D8590] to-[#6E6E73] text-white rounded text-xs transition-colors"
                  style={{ boxShadow: '0 2px 4px 0 rgba(0,0,0,0.38)', border: 'none' }}
                  onClick={() => { setShowAddForm(false); setAddError(null); }}
                  disabled={addLoading}
                >
                  취소
                </button>
              </div>
            </form>
          )}
        </Modal>
        {/* 업체+담당자 추가 모달 (blur-only, 어두운 배경 없음) */}
        {showAddVendorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs" onClick={handleAddVendorCancel}>
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-0 relative" onClick={e => e.stopPropagation()}>
              {/* CardContent 느낌: form에 padding 적용 */}
              <form onSubmit={handleAddVendorSave} className="p-6 pt-4 space-y-6">
                {/* 에러 메시지 */}
                {addVendorError && <div className="text-red-500 text-sm text-center">{addVendorError}</div>}
                {/* 업체 정보 입력 (2행 2열 그리드) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mb-2">
                  {/* 1행: 업체명 | 결제방식 */}
                  <div>
                    <label className="block font-semibold mb-1">업체명 <span className="text-red-500">*</span></label>
                    <input type="text" name="vendor_name" value={addVendorForm.vendor_name} onChange={handleAddVendorFormChange} className="w-full border rounded px-3 py-2" placeholder="예: 한슬테크" required />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">결제방식</label>
                    <input type="text" name="vendor_payment_schedule" value={addVendorForm.vendor_payment_schedule} onChange={handleAddVendorFormChange} className="w-full border rounded px-3 py-2" placeholder="예: 현금, 계좌이체 등" />
                  </div>
                  {/* 2행: 전화번호 | 팩스번호 */}
                  <div>
                    <label className="block font-semibold mb-1">전화번호</label>
                    <input type="text" name="vendor_phone" value={addVendorForm.vendor_phone} onChange={handleAddVendorFormChange} className="w-full border rounded px-3 py-2" placeholder="예: 02-1234-5678" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">팩스번호</label>
                    <input type="text" name="vendor_fax" value={addVendorForm.vendor_fax} onChange={handleAddVendorFormChange} className="w-full border rounded px-3 py-2" placeholder="예: 02-1234-5679" />
                  </div>
                </div>
                {/* 담당자 정보 입력 (여러 명) */}
                <div className="border-t pt-4 mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">담당자 정보 <span className="text-red-500">*</span></div>
                    <button type="button" className="text-[#1777CB] font-semibold text-xs bg-transparent hover:underline px-2 py-1 rounded transition-colors" onClick={handleAddContactAdd}>+ 담당자 추가</button>
                  </div>
                  {addContacts.map((contact, idx) => (
                    <div key={idx} className="mb-2 border rounded p-3 relative bg-gray-50 shadow-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold">담당자 {idx + 1}</span>
                        {addContacts.length > 1 && (
                          <button type="button" className="text-red-500 text-xs ml-2" onClick={() => handleAddContactRemove(idx)} title="담당자 삭제">삭제</button>
                        )}
                      </div>
                      {/* 2행 2열 그리드로 입력란 배치 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                        {/* 이름 */}
                        <div>
                          <label className="block mb-1">이름 <span className="text-red-500">*</span></label>
                          <input type="text" name="contact_name" value={contact.contact_name} onChange={e => handleAddContactChange(idx, e)} className="w-full border rounded px-3 py-2 bg-white" placeholder="예: 홍길동" required />
                        </div>
                        {/* 직급 */}
                        <div>
                          <label className="block mb-1">직급</label>
                          <input type="text" name="position" value={contact.position} onChange={e => handleAddContactChange(idx, e)} className="w-full border rounded px-3 py-2 bg-white" placeholder="예: 과장" />
                        </div>
                        {/* 연락처 */}
                        <div>
                          <label className="block mb-1">연락처</label>
                          <input type="text" name="contact_phone" value={contact.contact_phone} onChange={e => handleAddContactChange(idx, e)} className="w-full border rounded px-3 py-2 bg-white" placeholder="예: 010-1234-5678" />
                        </div>
                        {/* 이메일 */}
                        <div>
                          <label className="block mb-1">이메일</label>
                          <input type="email" name="contact_email" value={contact.contact_email} onChange={e => handleAddContactChange(idx, e)} className="w-full border rounded px-3 py-2 bg-white" placeholder="예: contact@supplier.co.kr" />
                          {contact.contact_email?.includes('@hansl.com') && (
                            <div className="text-red-500 text-xs mt-1">⚠️ 한슬 직원 이메일은 업체 담당자로 등록할 수 없습니다</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* 저장/취소 버튼 */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="w-1/2 px-3 py-2 bg-gradient-to-l from-[#43A0EC] to-[#1777CB] text-white rounded text-base transition-colors"
                    style={{ boxShadow: '0 2px 4px 0 rgba(0,0,0,0.38)', border: 'none' }}
                    disabled={addVendorLoading}
                  >
                    {addVendorLoading ? '저장 중...' : '저장'}
                  </button>
                  <button
                    type="button"
                    className="w-1/2 px-3 py-2 bg-gradient-to-l from-[#7D8590] to-[#6E6E73] text-white rounded text-base transition-colors"
                    style={{ boxShadow: '0 2px 4px 0 rgba(0,0,0,0.38)', border: 'none' }}
                    onClick={handleAddVendorCancel}
                    disabled={addVendorLoading}
                  >
                    취소
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}