'use client';
import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// 업체 추가 페이지 컴포넌트
export default function VendorAddPage() {
  // 업체 정보 상태
  const [vendor, setVendor] = useState({
    vendor_name: '',
    vendor_phone: '',
    vendor_fax: '',
    vendor_payment_schedule: '',
  });
  // 담당자 정보 상태 (1명)
  const [contact, setContact] = useState({
    contact_name: '',
    position: '',
    contact_phone: '',
    contact_email: '',
  });
  // 로딩/에러 상태
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 업체 입력값 변경 핸들러
  const handleVendorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setVendor((prev) => ({ ...prev, [name]: value }));
  };
  // 담당자 입력값 변경 핸들러
  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setContact((prev) => ({ ...prev, [name]: value }));
  };

  // 저장 버튼 클릭 시 실행되는 함수
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // 필수값 체크
    if (!vendor.vendor_name.trim()) {
      setError('업체명을 입력해 주세요.');
      return;
    }
    if (!contact.contact_name.trim()) {
      setError('담당자 이름을 입력해 주세요.');
      return;
    }
    if (contact.contact_email && contact.contact_email.includes('@hansl.com')) {
      setError('한슬 직원 이메일은 업체 담당자로 등록할 수 없습니다.');
      return;
    }
    setLoading(true);
    // 1. 업체(vendors) 테이블에 insert
    const { data: vendorData, error: vendorError } = await supabase.from('vendors').insert([
      vendor
    ]).select('id').single();
    if (vendorError || !vendorData) {
      setError('업체 저장에 실패했습니다.');
      setLoading(false);
      return;
    }
    // 2. 담당자(vendor_contacts) 테이블에 insert (vendor_id 연결)
    const { error: contactError } = await supabase.from('vendor_contacts').insert([
      {
        ...contact,
        vendor_id: vendorData.id,
      }
    ]);
    if (contactError) {
      setError('담당자 저장에 실패했습니다.');
      setLoading(false);
      return;
    }
    // 저장 성공: 창 닫고 부모창 새로고침
    if (window.opener) window.opener.location.reload();
    window.close();
  };

  // 취소 버튼 클릭 시: 창 닫고 부모창 새로고침
  const handleCancel = () => {
    if (window.opener) window.opener.location.reload();
    window.close();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        className="bg-white p-6 rounded shadow-md w-full max-w-md space-y-6"
        onSubmit={handleSave}
      >
        <h2 className="text-xl font-bold mb-2 text-center">업체 + 담당자 추가</h2>
        {/* 에러 메시지 */}
        {error && <div className="text-red-500 text-sm text-center">{error}</div>}
        {/* 업체 정보 입력 */}
        <div>
          <label className="block font-semibold mb-1">업체명 <span className="text-red-500">*</span></label>
          <input
            type="text"
            name="vendor_name"
            value={vendor.vendor_name}
            onChange={handleVendorChange}
            className="w-full border rounded px-3 py-2 mb-2"
            placeholder="예: 한슬테크"
            required
          />
          <label className="block font-semibold mb-1">전화번호</label>
          <input
            type="text"
            name="vendor_phone"
            value={vendor.vendor_phone}
            onChange={handleVendorChange}
            className="w-full border rounded px-3 py-2 mb-2"
            placeholder="예: 02-1234-5678"
          />
          <label className="block font-semibold mb-1">팩스번호</label>
          <input
            type="text"
            name="vendor_fax"
            value={vendor.vendor_fax}
            onChange={handleVendorChange}
            className="w-full border rounded px-3 py-2 mb-2"
            placeholder="예: 02-1234-5679"
          />
          <label className="block font-semibold mb-1">결제방식</label>
          <input
            type="text"
            name="vendor_payment_schedule"
            value={vendor.vendor_payment_schedule}
            onChange={handleVendorChange}
            className="w-full border rounded px-3 py-2"
            placeholder="예: 현금, 계좌이체 등"
          />
        </div>
        {/* 담당자 정보 입력 */}
        <div className="border-t pt-4 mt-2">
          <div className="font-semibold mb-2">담당자 정보 <span className="text-red-500">*</span></div>
          <label className="block mb-1">이름 <span className="text-red-500">*</span></label>
          <input
            type="text"
            name="contact_name"
            value={contact.contact_name}
            onChange={handleContactChange}
            className="w-full border rounded px-3 py-2 mb-2"
            placeholder="예: 홍길동"
            required
          />
          <label className="block mb-1">직급</label>
          <input
            type="text"
            name="position"
            value={contact.position}
            onChange={handleContactChange}
            className="w-full border rounded px-3 py-2 mb-2"
            placeholder="예: 과장"
          />
          <label className="block mb-1">연락처</label>
          <input
            type="text"
            name="contact_phone"
            value={contact.contact_phone}
            onChange={handleContactChange}
            className="w-full border rounded px-3 py-2 mb-2"
            placeholder="예: 010-1234-5678"
          />
          <label className="block mb-1">이메일</label>
          <input
            type="email"
            name="contact_email"
            value={contact.contact_email}
            onChange={handleContactChange}
            className="w-full border rounded px-3 py-2"
            placeholder="예: hong@supplier.co.kr"
          />
          {contact.contact_email?.includes('@hansl.com') && (
            <div className="text-red-500 text-xs mt-1">⚠️ 한슬 직원 이메일은 업체 담당자로 등록할 수 없습니다</div>
          )}
        </div>
        {/* 저장/취소 버튼 */}
        <div className="flex justify-between pt-4">
          <button
            type="button"
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
            onClick={handleCancel}
            disabled={loading}
          >
            취소
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </div>
  );
} 