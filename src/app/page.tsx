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
      <div className="relative w-60 h-60 flex items-center justify-center">
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
                width={240}
                height={240}
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
                width={240}
                height={240}
                priority
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
