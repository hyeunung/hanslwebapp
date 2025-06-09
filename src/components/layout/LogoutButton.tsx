"use client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const { user } = useAuth();
  const router = useRouter();
  if (!user) return null;
  return (
    <div style={{ position: 'fixed', top: 24, right: 32, zIndex: 100 }}>
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-1 text-xs text-red-500 font-semibold px-2 py-1 border-none shadow-none hover:bg-red-50 focus-visible:ring-0 focus:outline-none"
        onClick={async () => {
          await import("@/lib/supabaseClient").then(({ supabase }) => supabase.auth.signOut());
          router.push("/login");
        }}
      >
        <LogOut className="size-4 mr-1" />
        로그아웃
      </Button>
    </div>
  );
}
