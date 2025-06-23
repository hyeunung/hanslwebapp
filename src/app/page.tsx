import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white px-4">
      <Image
        src="/logo_symbol.svg"
        alt="Hansl Logo"
        width={80}
        height={80}
        className="mb-4"
        priority
      />
      <h1 className="text-3xl font-bold mb-2">Hansl WebApp</h1>
      <p className="text-gray-600 mb-8 text-center">
        한슬 웹앱에 오신 것을 환영합니다.<br />
        아래 메뉴에서 원하는 기능을 선택하세요.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/dashboard">
          <button className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
            대시보드
          </button>
        </Link>
        <Link href="/purchase/list">
          <button className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 transition">
            발주 목록
          </button>
        </Link>
        <Link href="/login">
          <button className="px-6 py-3 bg-gray-600 text-white rounded hover:bg-gray-700 transition">
            로그인
          </button>
        </Link>
      </div>
    </div>
  );
}
