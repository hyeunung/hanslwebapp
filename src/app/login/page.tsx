// [로그인/회원가입/비밀번호 재설정 페이지]
"use client";
import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/providers/AuthProvider";

export default function LoginPage() {
  const { control, handleSubmit } = useForm();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  // 회원가입/비밀번호 재설정 다이얼로그 상태
  const [openSignup, setOpenSignup] = useState(false);
  const [openReset, setOpenReset] = useState(false);

  // 회원가입 폼
  const {
    control: signupControl,
    handleSubmit: handleSignupSubmit,
    reset: resetSignup,
    formState: { errors: signupErrors },
  } = useForm();
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupMsg, setSignupMsg] = useState("");

  // 비밀번호 재설정 폼
  const {
    control: resetControl,
    handleSubmit: handleResetSubmit,
    reset: resetReset,
    formState: { errors: resetErrors },
  } = useForm();
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

  // 자동 로그인 체크박스 상태 (기본값: true)
  const [autoLogin, setAutoLogin] = useState(true);

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError("");
    const { email, password } = data;
    let signInResult;
    if (autoLogin) {
      // 자동 로그인: 기존 supabase 인스턴스(세션 브라우저 저장)
      signInResult = await supabase.auth.signInWithPassword({ email, password });
    } else {
      // 자동 로그인 해제: persistSession: false로 임시 인스턴스 생성 (세션 브라우저 미저장)
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseTemp = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
      );
      signInResult = await supabaseTemp.auth.signInWithPassword({ email, password });
    }
    const { data: signInData, error } = signInResult;
    setLoading(false);
    if (error) {
      setError(error.message);
    } else if (signInData && signInData.user) {
      router.push("/dashboard");
    } else {
      setError("로그인에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  // 회원가입 처리
  const onSignup = async (data: any) => {
    setSignupLoading(true);
    setSignupMsg("");
    const { email, password } = data;
    const { error } = await supabase.auth.signUp({ email, password });
    setSignupLoading(false);
    if (error) {
      setSignupMsg(error.message);
    } else {
      setSignupMsg("회원가입이 완료되었습니다! 이메일을 확인해 주세요.");
      resetSignup();
    }
  };

  // 비밀번호 재설정 처리
  const onReset = async (data: any) => {
    setResetLoading(true);
    setResetMsg("");
    const { email } = data;
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setResetLoading(false);
    if (error) {
      setResetMsg(error.message);
    } else {
      setResetMsg("비밀번호 재설정 메일이 발송되었습니다. 이메일을 확인해 주세요.");
      resetReset();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 min-w-[320px] w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-4 text-center">로그인</h1>
        <form onSubmit={handleSubmit(onSubmit)} onKeyDown={e => { if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); } }}>
          <div className="flex flex-col gap-4">
            <Controller
              name="email"
              control={control}
              defaultValue=""
              rules={{ required: "이메일을 입력하세요." }}
              render={({ field, fieldState }) => (
                <Input
                  {...field}
                  type="email"
                  placeholder="이메일"
                  autoComplete="email"
                  className={fieldState.error ? "border-destructive" : ""}
                />
              )}
            />
            <Controller
              name="password"
              control={control}
              defaultValue=""
              rules={{ required: "비밀번호를 입력하세요." }}
              render={({ field, fieldState }) => (
                <Input
                  {...field}
                  type="password"
                  placeholder="비밀번호"
                  autoComplete="current-password"
                  className={fieldState.error ? "border-destructive" : ""}
                />
              )}
            />
            {/* 자동 로그인 체크박스: 체크 시 세션 브라우저 저장, 해제 시 세션 미저장(새로고침 시 자동 로그아웃) */}
            <label className="flex items-center gap-2 select-none">
              <Checkbox
                checked={autoLogin}
                onCheckedChange={(checked: boolean) => setAutoLogin(!!checked)}
                id="auto-login"
              />
              <span className="text-sm">자동 로그인</span>
            </label>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || openSignup || openReset}
            >
              {loading ? "로그인 중..." : "로그인"}
            </Button>
            <div className="flex flex-row gap-2 justify-center">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpenSignup(true)}>
                회원가입
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpenReset(true)}>
                비밀번호 재설정
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* 회원가입 다이얼로그 */}
      <Dialog open={openSignup} onOpenChange={setOpenSignup}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>회원가입</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSignupSubmit(onSignup)} onKeyDown={e => { if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); } }}>
            <div className="flex flex-col gap-4 mt-2">
              <Controller
                name="email"
                control={signupControl}
                defaultValue=""
                rules={{ required: "이메일을 입력하세요." }}
                render={({ field }) => (
                  <Input {...field} type="email" placeholder="이메일" className={signupErrors.email ? "border-destructive" : ""} />
                )}
              />
              <Controller
                name="password"
                control={signupControl}
                defaultValue=""
                rules={{ required: "비밀번호를 입력하세요." }}
                render={({ field }) => (
                  <Input {...field} type="password" placeholder="비밀번호" className={signupErrors.password ? "border-destructive" : ""} />
                )}
              />
              {signupMsg && (
                <Alert variant={signupMsg.includes("완료") ? "default" : "destructive"}>
                  <AlertDescription>{signupMsg}</AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button type="submit" className="w-full" disabled={signupLoading}>
                  {signupLoading ? "회원가입 중..." : "회원가입"}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 비밀번호 재설정 다이얼로그 */}
      <Dialog open={openReset} onOpenChange={setOpenReset}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>비밀번호 재설정</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetSubmit(onReset)} onKeyDown={e => { if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); } }}>
            <div className="flex flex-col gap-4 mt-2">
              <Controller
                name="email"
                control={resetControl}
                defaultValue=""
                rules={{ required: "이메일을 입력하세요." }}
                render={({ field }) => (
                  <Input {...field} type="email" placeholder="이메일" className={resetErrors.email ? "border-destructive" : ""} />
                )}
              />
              {resetMsg && (
                <Alert variant={resetMsg.includes("발송") ? "default" : "destructive"}>
                  <AlertDescription>{resetMsg}</AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button type="submit" className="w-full" disabled={resetLoading}>
                  {resetLoading ? "발송 중..." : "비밀번호 재설정 메일 발송"}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
} 