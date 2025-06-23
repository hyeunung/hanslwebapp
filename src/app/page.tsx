"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [showEng, setShowEng] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowEng(true), 2000); // 2초 후 전환
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white px-4">
      <div className="mb-4 relative w-20 h-20 flex items-center justify-center">
        <AnimatePresence>
          {!showEng && (
            <motion.div
              key="kr"
              initial={{ opacity: 1, filter: "grayscale(0%) brightness(100%)" }}
              animate={{ opacity: 1, filter: "grayscale(0%) brightness(100%)" }}
              exit={{
                opacity: 0,
                filter: "grayscale(100%) brightness(60%) blur(2px)",
                transition: { duration: 1 }
              }}
              className="absolute w-full h-full flex items-center justify-center"
            >
              <Image
                src="/logo_kr.svg"
                alt="Hansl Korean Logo"
                width={80}
                height={80}
                priority
              />
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showEng && (
            <motion.div
              key="eng"
              initial={{
                opacity: 0,
                filter: "grayscale(100%) brightness(60%) blur(2px)"
              }}
              animate={{
                opacity: 1,
                filter: "grayscale(0%) brightness(100%) blur(0px)",
                transition: { duration: 1 }
              }}
              className="absolute w-full h-full flex items-center justify-center"
            >
              <Image
                src="/logo_eng.svg"
                alt="Hansl English Logo"
                width={80}
                height={80}
                priority
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
