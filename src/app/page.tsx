"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [showEng, setShowEng] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowEng(true), 2000); // 2초 후 전환
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <div className="relative w-[400px] h-[400px] flex items-center justify-center">
        <AnimatePresence>
          {!showEng && (
            <motion.div
              key="kr"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.7 } }}
              className="absolute w-full h-full flex items-center justify-center"
            >
              <Image
                src="/logo_kr.svg"
                alt="Hansl Korean Logo"
                width={400}
                height={400}
                priority
              />
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showEng && (
            <motion.div
              key="eng"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.7 } }}
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
