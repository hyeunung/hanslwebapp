import React, { useState } from "react";

interface ApproveActionButtonsProps {
  roles: string[]; // ex: ["middle_manager", "final_approver", "app_admin"]
  requestType: string; // "원자재" | "소모품"
  middleManagerStatus: string; // "approved" | "pending" | "rejected"
  finalManagerStatus: string; // "approved" | "pending" | "rejected"
  onApprove: () => void;
  onReject: () => void;
  onVerify: () => void;
  disabled?: boolean;
}

const ApproveActionButtons: React.FC<ApproveActionButtonsProps> = ({
  roles,
  requestType,
  middleManagerStatus,
  finalManagerStatus,
  onApprove,
  onReject,
  onVerify,
  disabled = false,
}) => {
  // 검증 버튼 클릭 후 상태 관리
  const [isVerified, setIsVerified] = useState(false);

  // 검증 버튼 클릭 핸들러
  const handleVerifyClick = () => {
    setIsVerified(true);
    onVerify();
  };
  // app_admin: 모든 버튼
  if (roles.includes("app_admin")) {
    return (
      <div className="flex gap-6">
        <Button
          style={{
            backgroundColor: (disabled || isVerified) ? '#e5e7eb' : '#A8E6CF',
            color: (disabled || isVerified) ? '#a3a3a3' : '#207744',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '1.15rem',
            boxShadow: '0 2px 8px 0 rgba(0,0,0,0.04)'
          }}
          className="px-8 py-3"
          onClick={handleVerifyClick}
          disabled={disabled || isVerified}
        >
          검&nbsp;&nbsp;&nbsp;증
        </Button>
        <Button
          style={{
            backgroundColor: (disabled || middleManagerStatus !== 'approved' || (!isVerified && roles.includes('final_approver'))) ? '#e5e7eb' : '#A2C8FA',
            color: (disabled || middleManagerStatus !== 'approved' || (!isVerified && roles.includes('final_approver'))) ? '#a3a3a3' : '#155fa0',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '1.15rem',
            boxShadow: '0 2px 8px 0 rgba(0,0,0,0.04)'
          }}
          className="px-8 py-3"
          onClick={onApprove}
          disabled={disabled || middleManagerStatus !== 'approved' || (!isVerified && roles.includes('final_approver'))}
        >
          승&nbsp;&nbsp;&nbsp;인
        </Button>
        <Button
          style={{
            backgroundColor: disabled ? '#e5e7eb' : '#FF8B94',
            color: disabled ? '#a3a3a3' : '#8B1E2D',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '1.15rem',
            boxShadow: '0 2px 8px 0 rgba(0,0,0,0.04)'
          }}
          className="px-8 py-3"
          onClick={onReject}
          disabled={disabled}
        >
          반&nbsp;&nbsp;&nbsp;려
        </Button>
      </div>
    );
  }
  // final_approver: 승인/반려만
  if (roles.includes("final_approver")) {
    return (
      <div className="flex gap-2">
        <Button style={{backgroundColor:'#FFD3B6', color:'#8D5524'}} onClick={onApprove} disabled={disabled}>승인</Button>
        <Button style={{backgroundColor:'#FF8B94', color:'#8B1E2D'}} onClick={onReject} disabled={disabled}>반려</Button>
      </div>
    );
  }
  // middle_manager: 검증만
  if (roles.includes("middle_manager")) {
    return (
      <div className="flex gap-2">
        <Button style={{backgroundColor:'#A8E6CF', color:'#207744'}} onClick={onVerify} disabled={disabled}>검증</Button>
      </div>
    );
  }
  // 일반직원: 버튼 없음
  return null;
};

import { Button } from "@/components/ui/button";

export default ApproveActionButtons;
