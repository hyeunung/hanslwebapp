// 서버 컴포넌트: 브라우저에서 동작하는 UI/애니메이션은 클라이언트 컴포넌트에서 처리합니다.
import PurchaseApprovePageClient from "./PurchaseApprovePageClient";

export default function PurchaseApprovePage() {
  // 클라이언트 컴포넌트만 렌더링
  return <PurchaseApprovePageClient />;
}
