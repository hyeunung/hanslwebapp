"use client";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);
  return <>{children}</>;
} 