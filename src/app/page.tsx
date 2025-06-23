import Image from "next/image";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-white">
      <h1 className="text-4xl font-bold mb-4">HANSL WEB APP</h1>
      <p className="text-lg text-gray-600 mb-8">한슬 웹앱에 오신 것을 환영합니다.</p>
      <div className="flex gap-4">
        <a href="/dashboard" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">대시보드 바로가기</a>
        <a href="/login" className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition">로그인</a>
      </div>
      <footer className="mt-16 text-sm text-gray-400">© 2024 HANSL. All rights reserved.</footer>
    </main>
  );
}
