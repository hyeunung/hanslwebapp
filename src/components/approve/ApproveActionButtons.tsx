import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

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

  // 디버깅용 로그
  console.log('[ApproveActionButtons] 현재 상태:', {
    roles,
    middleManagerStatus,
    finalManagerStatus,
    isVerified,
    disabled
  });

  // middleManagerStatus가 'approved'가 아닌 상태(pending 또는 rejected)로 변경되면 검증 상태를 초기화합니다.
  useEffect(() => {
    if (middleManagerStatus !== 'approved') {
      setIsVerified(false);
    }
  }, [middleManagerStatus]);

  // 검증 버튼 클릭 핸들러
  const handleVerifyClick = () => {
    setIsVerified(true);
    onVerify();
  };
  
  // app_admin 또는 ceo: 모든 버튼
  if (roles.includes("app_admin") || roles.includes("ceo")) {
    return (
      <div className="flex gap-6">
        <Button
          style={{
            background: (disabled || isVerified || middleManagerStatus === 'approved')
              ? '#e5e7eb'
              : 'linear-gradient(270deg, #6fd47e 0%, #5fcf6c 100%)',
            color: (disabled || isVerified || middleManagerStatus === 'approved') ? '#a3a3a3' : '#fff',
            borderRadius: '10px',
            fontWeight: 800,
            fontSize: '1.15rem',
            boxShadow: (disabled || isVerified || middleManagerStatus === 'approved')
              ? '0 2px 8px 0 rgba(0,0,0,0.04)'
              : '0 2px 8px 0 rgba(60, 120, 60, 0.35)'
          }}
          className="px-8 py-3 transition-transform hover:brightness-105 hover:scale-105 active:scale-95 focus:ring-2 focus:ring-green-300"
          onClick={handleVerifyClick}
          disabled={disabled || isVerified || middleManagerStatus === 'approved'}
        >
          검&nbsp;&nbsp;&nbsp;증
        </Button>
        <Button
          style={{
            background: (disabled || middleManagerStatus !== 'approved' || finalManagerStatus === 'approved' || (!isVerified && roles.includes('final_approver')))
              ? '#e5e7eb'
              : 'linear-gradient(270deg, #6fd47e 0%, #5fcf6c 100%)',
            color: (disabled || middleManagerStatus !== 'approved' || finalManagerStatus === 'approved' || (!isVerified && roles.includes('final_approver')))
              ? '#a3a3a3'
              : '#fff',
            borderRadius: '10px',
            fontWeight: 800,
            fontSize: '1.15rem',
            boxShadow: (disabled || middleManagerStatus !== 'approved' || finalManagerStatus === 'approved' || (!isVerified && roles.includes('final_approver')))
              ? '0 2px 8px 0 rgba(0,0,0,0.04)'
              : '0 2px 8px 0 rgba(60, 120, 60, 0.35)'
          }}
          className="px-8 py-3 transition-transform hover:brightness-105 hover:scale-105 active:scale-95 focus:ring-2 focus:ring-green-300"
          onClick={onApprove}
          disabled={disabled || middleManagerStatus !== 'approved' || finalManagerStatus === 'approved' || (!isVerified && roles.includes('final_approver'))}
        >
          승&nbsp;&nbsp;&nbsp;인
        </Button>
        <Button
          style={{
            background: disabled
              ? '#e5e7eb'
              : 'linear-gradient(270deg, #ff8a8a 0%, #ff5e62 100%)',
            color: disabled ? '#a3a3a3' : '#fff',
            borderRadius: '10px',
            fontWeight: 800,
            fontSize: '1.15rem',
            boxShadow: disabled
              ? '0 2px 8px 0 rgba(0,0,0,0.04)'
              : '0 2px 8px 0 rgba(180, 60, 60, 0.35)'
          }}
          className="px-8 py-3 transition-transform hover:brightness-105 hover:scale-105 active:scale-95 focus:ring-2 focus:ring-red-300"
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
        <Button
          style={{
            background: disabled || middleManagerStatus !== 'approved' || finalManagerStatus === 'approved'
              ? '#e5e7eb'
              : 'linear-gradient(270deg, #6fd47e 0%, #5fcf6c 100%)',
            color: disabled || middleManagerStatus !== 'approved' || finalManagerStatus === 'approved' ? '#a3a3a3' : '#fff',
            borderRadius: '10px',
            fontWeight: 800,
            fontSize: '1.15rem',
            boxShadow: disabled || middleManagerStatus !== 'approved' || finalManagerStatus === 'approved'
              ? '0 2px 8px 0 rgba(0,0,0,0.04)'
              : '0 2px 8px 0 rgba(60, 120, 60, 0.35)'
          }}
          className="px-8 py-3 transition-transform hover:brightness-105 hover:scale-105 active:scale-95 focus:ring-2 focus:ring-green-300"
          onClick={onApprove}
          disabled={disabled || middleManagerStatus !== 'approved' || finalManagerStatus === 'approved'}
        >
          승인
        </Button>
        <Button
          style={{
            background: disabled
              ? '#e5e7eb'
              : 'linear-gradient(270deg, #ff8a8a 0%, #ff5e62 100%)',
            color: disabled ? '#a3a3a3' : '#fff',
            borderRadius: '10px',
            fontWeight: 800,
            fontSize: '1.15rem',
            boxShadow: disabled
              ? '0 2px 8px 0 rgba(0,0,0,0.04)'
              : '0 2px 8px 0 rgba(180, 60, 60, 0.35)'
          }}
          className="px-8 py-3 transition-transform hover:brightness-105 hover:scale-105 active:scale-95 focus:ring-2 focus:ring-red-300"
          onClick={onReject}
          disabled={disabled}
        >
          반료
        </Button>
      </div>
    );
  }
  
  // middle_manager: 검증만
  if (roles.includes("middle_manager")) {
    return (
      <div className="flex gap-2">
        <Button
          style={{
            background: disabled || middleManagerStatus === 'approved'
              ? '#e5e7eb'
              : 'linear-gradient(270deg, #6fd47e 0%, #5fcf6c 100%)',
            color: disabled || middleManagerStatus === 'approved' ? '#a3a3a3' : '#fff',
            borderRadius: '10px',
            fontWeight: 800,
            fontSize: '1.15rem',
            boxShadow: disabled || middleManagerStatus === 'approved'
              ? '0 2px 8px 0 rgba(0,0,0,0.04)'
              : '0 2px 8px 0 rgba(60, 120, 60, 0.35)'
          }}
          className="px-8 py-3 transition-transform hover:brightness-105 hover:scale-105 active:scale-95 focus:ring-2 focus:ring-green-300"
          onClick={onVerify}
          disabled={disabled || middleManagerStatus === 'approved'}
        >
          검증
        </Button>
      </div>
    );
  }
  
  // 일반직원: 버튼 없음
  return null;
};

export default ApproveActionButtons;