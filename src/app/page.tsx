"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

export default function Home() {
  const [visible, setVisible] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const timer1 = setTimeout(() => setVisible(false), 2000); // 2초 후 페이드아웃
    const timer2 = setTimeout(() => router.replace("/purchase/list"), 4000); // 4초 후 이동
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <div className="relative w-[400px] h-[400px] flex items-center justify-center">
        <AnimatePresence>
          {visible && (
            <motion.div
              key="eng"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.7 } }}
              exit={{ opacity: 0, transition: { duration: 0.7 } }}
              className="absolute w-full h-full flex items-center justify-center"
            >
              <Image
                src="/logo_eng.svg"
                alt="Hansl English Logo"
                width={400}
                height={400}
                priority
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
