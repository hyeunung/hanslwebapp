"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mail } from "lucide-react";

interface EmailButtonProps {
  onClick?: () => void;
  style?: React.CSSProperties;
  inline?: boolean;
}

export default function EmailButton({ onClick, style, inline = false }: EmailButtonProps) {
  const [emailButtonPosition, setEmailButtonPosition] = useState({ x: 100, y: 200 });
  const [isDragging, setIsDragging] = useState(false);

  // localStorage에서 저장된 위치 복원
  useEffect(() => {
    if (!inline) {
      const savedPosition = localStorage.getItem('emailButtonPosition');
      if (savedPosition) {
        setEmailButtonPosition(JSON.parse(savedPosition));
      }
    }
  }, [inline]);

  const handleDragEnd = (event: any, info: any) => {
    setTimeout(() => {
      setIsDragging(false);
    }, 100);

    const newPosition = {
      x: emailButtonPosition.x + info.offset.x,
      y: emailButtonPosition.y + info.offset.y
    };
    setEmailButtonPosition(newPosition);
    localStorage.setItem('emailButtonPosition', JSON.stringify(newPosition));
  };

  const handleClick = () => {
    if (!isDragging && onClick) {
      onClick();
    }
  };

  if (inline) {
    // 인라인 버튼: 드래그/포지션/애니메이션 없이 렌더링
    return (
      <div
        onClick={handleClick}
        style={{
          width: '44px',
          height: '100%',
          backgroundColor: 'var(--background)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: 'none',
          border: '1px solid var(--border)',
          ...style,
        }}
        className="hover:shadow-sm transition-shadow duration-200"
      >
        <Mail 
          size={18} 
          style={{ 
            color: 'var(--primary)',
            pointerEvents: 'none'
          }} 
        />
        <span
          className="font-bold text-xs text-black"
          style={{
            writingMode: 'vertical-lr',
            textOrientation: 'mixed',
            letterSpacing: '0.1em',
            marginTop: 4,
          }}
        >
          E-mail
        </span>
      </div>
    );
  }

  // 기존 floating 버튼
  return (
    <motion.div
      drag
      dragElastic={0}
      dragMomentum={false}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      whileDrag={{ scale: 1.05 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      animate={{ 
        x: emailButtonPosition.x, 
        y: emailButtonPosition.y 
      }}
      transition={{
        type: "spring",
        damping: 25,
        stiffness: 400
      }}
      style={{
        position: 'fixed',
        width: '40px',
        height: '40px',
        backgroundColor: 'var(--background)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        border: '1px solid var(--border)',
        zIndex: 99999,
        touchAction: 'none',
        ...style,
      }}
      className="shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      <Mail 
        size={18} 
        style={{ 
          color: 'var(--primary)',
          pointerEvents: 'none'
        }} 
      />
    </motion.div>
  );
}
