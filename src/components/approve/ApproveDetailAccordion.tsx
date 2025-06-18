import React from "react";
import { RotateCcw } from 'lucide-react';

interface ItemDetail {
  lineNumber: number;
  itemName: string;
  specification: string;
  quantity: number;
  unitPriceValue: number;
  amountValue: number;
  remark?: string;
}

interface ApproveDetailAccordionProps {
  requestType: string;
  paymentCategory: string;
  vendorName: string;
  contactName: string;
  requesterName: string;
  requestDate: string;
  deliveryRequestDate: string;
  projectVendor: string;
  salesOrderNumber: string;
  projectItem: string;
  items: ItemDetail[];
}

import ApproveActionButtons from "./ApproveActionButtons";

import { supabase } from '@/lib/supabaseClient';
import { useState } from 'react';

interface ApproveDetailAccordionExtraProps {
  id?: string;
  middleManagerStatus?: string;
  finalManagerStatus?: string;
  onMiddleManagerStatusChange?: (status: string) => void;
  onFinalManagerStatusChange?: (status: string) => void;
}

const ApproveDetailAccordion: React.FC<ApproveDetailAccordionProps & ApproveDetailAccordionExtraProps> = ({
  id,
  requestType,
  paymentCategory,
  vendorName,
  contactName,
  requesterName,
  requestDate,
  deliveryRequestDate,
  projectVendor,
  salesOrderNumber,
  projectItem,
  items,
  middleManagerStatus: initialMiddleManagerStatus = 'pending',
  finalManagerStatus: initialFinalManagerStatus = 'pending',
  onMiddleManagerStatusChange,
  onFinalManagerStatusChange,
}) => {
  // 총합 계산
  const totalAmount = items.reduce((sum, item) => sum + (item.amountValue || 0), 0);

  // 실제 상태 관리
  const [middleManagerStatus, setMiddleManagerStatus] = useState(initialMiddleManagerStatus);
  const [finalManagerStatus, setFinalManagerStatus] = useState(initialFinalManagerStatus);
  // TODO: 실제 로그인 유저의 roles를 props로 받아와야 함 (임시 예시)
  const roles = ["app_admin"];
  const handleApprove = async () => {
    console.log("handleApprove called, id:", id);
    if (!id) {
      console.error("No id provided!");
      alert("에러: id 값이 없습니다.");
      return;
    }
    const { error, data } = await supabase
      .from('purchase_requests')
      .update({ final_manager_status: 'approved' })
      .eq('id', id);
    console.log("Supabase update result (approve):", { error, data });
    if (error) {
      alert("에러 발생: " + error.message);
      return;
    }
    setFinalManagerStatus('approved');
    if (typeof onFinalManagerStatusChange === 'function') {
      onFinalManagerStatusChange('approved');
    }
  };
  const handleReject = async () => {
    console.log("handleReject called, id:", id);
    if (!id) {
      console.error("No id provided!");
      alert("에러: id 값이 없습니다.");
      return;
    }
    const { error, data } = await supabase
      .from('purchase_requests')
      .update({ middle_manager_status: 'rejected', final_manager_status: 'rejected' })
      .eq('id', id);
    console.log("Supabase update result (reject):", { error, data });
    if (error) {
      alert("에러 발생: " + error.message);
      return;
    }
    setMiddleManagerStatus('rejected');
    setFinalManagerStatus('rejected');
    if (typeof onMiddleManagerStatusChange === 'function') {
      onMiddleManagerStatusChange('rejected');
    }
    if (typeof onFinalManagerStatusChange === 'function') {
      onFinalManagerStatusChange('rejected');
    }
  };
  const handleVerify = async () => {
    console.log("handleVerify called, id:", id);
    if (!id) {
      console.error("No id provided!");
      alert("에러: id 값이 없습니다.");
      return;
    }
    const { error, data } = await supabase
      .from('purchase_requests')
      .update({ middle_manager_status: 'approved' })
      .eq('id', id);
    console.log("Supabase update result (verify):", { error, data });
    if (error) {
      alert("에러 발생: " + error.message);
      return;
    }
    setMiddleManagerStatus('approved');
    if (typeof onMiddleManagerStatusChange === 'function') {
      onMiddleManagerStatusChange('approved');
    }
  };


  return (
    <div
      className="flex justify-center w-full py-8"
      style={{ background: "transparent", maxWidth: '1200px', margin: '0 auto' }}
    >
      <div
        className="flex flex-col gap-4 px-4 sm:px-8 py-8 items-center w-full"
        style={{
          background: "#f8f9fa",
          borderRadius: "16px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          maxWidth: "100%",
          width: "100%",
          margin: "0 auto",
        }}
      >
        {/* 중앙 상단: 역할별 버튼 */}
        <div className="w-full flex justify-between items-center mt-0 mb-4">
          <div className="flex-1 flex justify-center">
            <ApproveActionButtons
              roles={roles}
              requestType={requestType}
              middleManagerStatus={middleManagerStatus}
              finalManagerStatus={finalManagerStatus}
              onApprove={handleApprove}
              onReject={handleReject}
              onVerify={handleVerify}
            />
          </div>
          <button
            className="ml-4"
            title="초기화"
            style={{ background: 'none', border: 'none', padding: 0, borderRadius: '50%', cursor: 'pointer', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={async () => {
              console.log("초기화 버튼 클릭, id:", id);
              if (!id) {
                console.error("No id provided!");
                alert("에러: id 값이 없습니다.");
                return;
              }
              const { error, data } = await supabase
                .from('purchase_requests')
                .update({ middle_manager_status: 'pending', final_manager_status: 'pending' })
                .eq('id', id);
              console.log("Supabase update result (reset):", { error, data });
              if (error) {
                alert("에러 발생: " + error.message);
                return;
              }
              setMiddleManagerStatus('pending');
              setFinalManagerStatus('pending');
              if (typeof onMiddleManagerStatusChange === 'function') {
                onMiddleManagerStatusChange('pending');
              }
              if (typeof onFinalManagerStatusChange === 'function') {
                onFinalManagerStatusChange('pending');
              }
            }}
          >
            <RotateCcw className="w-5 h-5 text-gray-400 hover:text-gray-700" />
          </button>
        </div>
        <div className="flex flex-col lg:flex-row gap-8 items-start w-full mx-auto">
          {/* 왼쪽: 메타 정보 */}
          <div className="flex flex-col min-w-[220px] max-w-[320px] bg-white rounded-lg p-6 pr-4 shadow-sm space-y-4 w-full lg:w-auto">
            <div className="flex">
              <span className="text-sm text-gray-400 font-medium leading-none w-2/5">요청유형</span>
              <span className="text-sm text-gray-900 font-normal pr-5 leading-none flex-1 ml-1">{requestType}</span>
            </div>
            <div className="flex">
              <span className="text-sm text-gray-400 font-medium leading-none w-2/5">결제종류</span>
              <span className="text-sm text-gray-900 font-normal pr-5 leading-none flex-1 ml-1">{paymentCategory}</span>
            </div>
            <div className="flex">
              <span className="text-sm text-gray-400 font-medium leading-none w-2/5">업체명</span>
              <span className="text-sm text-gray-900 font-normal pr-5 leading-none flex-1 ml-1">{vendorName}</span>
            </div>
            <div className="flex">
              <span className="text-sm text-gray-400 font-medium leading-none w-2/5">담당자</span>
              <span className="text-sm text-gray-900 font-normal pr-5 leading-none flex-1 ml-1">{contactName}</span>
            </div>
            <div className="flex">
              <span className="text-sm text-gray-400 font-medium leading-none w-2/5">구매요구자</span>
              <span className="text-sm text-gray-900 font-normal pr-5 leading-none flex-1 ml-1">{requesterName}</span>
            </div>
            <div className="flex">
              <span className="text-sm text-gray-400 font-medium leading-none w-2/5">청구일</span>
              <span className="text-sm text-gray-900 font-normal pr-5 leading-none flex-1 ml-1">{requestDate}</span>
            </div>
            <div className="flex">
              <span className="text-sm text-gray-400 font-medium leading-none w-2/5">입고요청일</span>
              <span className="text-sm text-gray-900 font-normal pr-5 leading-none flex-1 ml-1">{deliveryRequestDate}</span>
            </div>
            <div className="flex">
              <span className="text-sm text-gray-400 font-medium leading-none w-2/5">PJ업체</span>
              <span className="text-sm text-gray-900 font-normal pr-5 leading-none flex-1 ml-1">{projectVendor}</span>
            </div>
            <div className="flex">
              <span className="text-sm text-gray-400 font-medium leading-none w-2/5">수주번호</span>
              <span className="text-sm text-gray-900 font-normal pr-5 leading-none flex-1 ml-1">{salesOrderNumber}</span>
            </div>
            <div className="flex">
              <span className="text-sm text-gray-400 font-medium leading-none w-2/5">item</span>
              <span className="text-sm text-gray-900 font-normal pr-5 leading-none flex-1 ml-1">{projectItem}</span>
            </div>
      </div>
          {/* 오른쪽: 품목 테이블 */}
          <div className="flex-1 bg-white rounded-lg p-6 shadow-sm w-full overflow-x-auto">
            <table className="w-full min-w-[700px] max-w-full text-xs">
          <thead>
            <tr className="bg-gray-100">
                  <th className="px-2 py-1 w-20 text-center">번호</th>
                  <th className="px-2 py-1 min-w-[120px] text-center">품명</th>
                  <th className="px-2 py-1 min-w-[180px] text-center">규격</th>
                  <th className="px-2 py-1 w-20 text-center">수량</th>
                  <th className="px-2 py-1 min-w-[80px] text-center">단가(₩)</th>
                  <th className="px-2 py-1 min-w-[80px] text-center">합계(₩)</th>
                  <th className="px-2 py-1 min-w-[120px] text-center">비고</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
                  <tr key={item.lineNumber}>
                    <td className="text-center px-2 py-1 w-16">{idx + 1}</td>
                    <td className="text-center px-2 py-1 min-w-[120px]">{item.itemName}</td>
                    <td className="text-left px-2 py-1 min-w-[180px]">{item.specification}</td>
                    <td className="text-center px-2 py-1 w-20">{item.quantity}</td>
                    <td className="text-right px-2 py-1 min-w-[80px]">{item.unitPriceValue?.toLocaleString()} ₩</td>
                    <td className="text-right px-2 py-1 min-w-[80px]">{item.amountValue?.toLocaleString()} ₩</td>
                    <td className="text-center px-2 py-1 min-w-[120px]">{item.remark}</td>
              </tr>
            ))}
                <tr className="font-bold bg-gray-50">
                  <td colSpan={5} className="text-right px-2 py-1">총 합계</td>
                  <td className="text-right px-2 py-1 min-w-[80px]">{totalAmount.toLocaleString()} ₩</td>
                  <td className="min-w-[120px]" />
                </tr>
          </tbody>
        </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApproveDetailAccordion;