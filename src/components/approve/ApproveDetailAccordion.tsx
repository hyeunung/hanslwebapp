import React from "react";

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

const ApproveDetailAccordion: React.FC<ApproveDetailAccordionProps> = ({
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
}) => {
  return (
    <div className="flex flex-col md:flex-row gap-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
      {/* 좌측: 기본 정보 */}
      <div className="flex-1 space-y-2 min-w-[220px]">
        <div><b>요청유형:</b> {requestType}</div>
        <div><b>결제종류:</b> {paymentCategory}</div>
        <div><b>업체명:</b> {vendorName}</div>
        <div><b>담당자:</b> {contactName}</div>
        <div><b>구매요구자:</b> {requesterName}</div>
        <div><b>청구일:</b> {requestDate}</div>
        <div><b>입고요청일:</b> {deliveryRequestDate}</div>
        <div><b>PJ업체:</b> {projectVendor}</div>
        <div><b>수주번호:</b> {salesOrderNumber}</div>
        <div><b>item:</b> {projectItem}</div>
      </div>
      {/* 우측: 품목 테이블 */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-xs border border-gray-200 bg-white rounded-md">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-1">번호</th>
              <th className="px-2 py-1">품명</th>
              <th className="px-2 py-1">규격</th>
              <th className="px-2 py-1">수량</th>
              <th className="px-2 py-1">단가(₩)</th>
              <th className="px-2 py-1">합계(₩)</th>
              <th className="px-2 py-1">비고</th>
            </tr>
          </thead>
          <tbody>
            {items.slice().sort((a, b) => a.lineNumber - b.lineNumber).map((item, idx) => (
              <tr key={idx} className="border-t border-gray-100">
                <td className="px-2 py-1 text-center">{item.lineNumber}</td>
                <td className="px-2 py-1">{item.itemName}</td>
                <td className="px-2 py-1">{item.specification}</td>
                <td className="px-2 py-1 text-center">{item.quantity}</td>
                <td className="px-2 py-1 text-right">{item.unitPriceValue.toLocaleString()}<span className="ml-0.5">₩</span></td>
                <td className="px-2 py-1 text-right">{item.amountValue.toLocaleString()}<span className="ml-0.5">₩</span></td>
                <td className="px-2 py-1">{item.remark || ""}</td>
              </tr>
            ))}
            {/* 총 합계 행 */}
            <tr className="border-t border-gray-300 bg-gray-50 font-semibold">
              <td className="px-2 py-1 text-center" colSpan={5}>총 합계</td>
              <td className="px-2 py-1 text-right" colSpan={1}>
                {items.reduce((sum, item) => sum + (item.amountValue || 0), 0).toLocaleString()}<span className="ml-0.5">₩</span>
              </td>
              <td className="px-2 py-1"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ApproveDetailAccordion;
