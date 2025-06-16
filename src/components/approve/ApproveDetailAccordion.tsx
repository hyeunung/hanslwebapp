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
  // 총합 계산
  const totalAmount = items.reduce((sum, item) => sum + (item.amountValue || 0), 0);

  return (
    <div
      className="flex justify-center w-full py-8"
      style={{ background: "transparent" }}
    >
      <div
        className="flex gap-8 px-8 py-8 items-start"
        style={{
          background: "#f8f9fa",
          borderRadius: "16px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          maxWidth: "none",
          width: "auto",
          margin: "0 auto",
        }}
      >
        {/* 왼쪽: 메타 정보 */}
        <div className="flex flex-col min-w-[240px] max-w-[320px] bg-white rounded-lg p-6 pr-4 shadow-sm space-y-4">
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
        <div className="flex-1 bg-white rounded-lg p-6 shadow-sm">
          <table className="min-w-[1100px] w-[1100px] text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 w-20 text-center">번호</th>
                <th className="px-2 py-1 w-[500px] text-center">품명</th>
                <th className="px-2 py-1 w-[1000px] text-center">규격</th>
                <th className="px-2 py-1 w-20 text-center">수량</th>
                <th className="px-2 py-1 w-80 text-center">단가(₩)</th>
                <th className="px-2 py-1 w-80 text-center">합계(₩)</th>
                <th className="px-2 py-1 w-[720px] text-center">비고</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.lineNumber}>
                  <td className="text-center px-2 py-1 w-16">{idx + 1}</td>
                  <td className="text-center px-2 py-1 w-[144px]">{item.itemName}</td>
                  <td className="text-left px-2 py-1 w-[720px]">{item.specification}</td>
                  <td className="text-center px-2 py-1 w-20">{item.quantity}</td>
                  <td className="text-right px-2 py-1 w-40">{item.unitPriceValue?.toLocaleString()} ₩</td>
                  <td className="text-right px-2 py-1 w-40">{item.amountValue?.toLocaleString()} ₩</td>
                  <td className="text-center px-2 py-1 w-[720px]">{item.remark}</td>
                </tr>
              ))}
              <tr className="font-bold bg-gray-50">
                <td colSpan={5} className="text-right px-2 py-1">총 합계</td>
                <td className="text-right px-2 py-1 w-40">{totalAmount.toLocaleString()} ₩</td>
                <td className="w-[720px]" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ApproveDetailAccordion; 