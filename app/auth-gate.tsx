"use client";

import {
  createClient,
  type Session,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import type { SupabaseAuthConfig } from "../lib/auth-config";
import { LanguageSwitch, useLocale } from "./locale";
import NoteFlowApp from "./noteflow-app";

type AuthGateProps = {
  config: SupabaseAuthConfig;
};

type LoginStep = "email" | "code";

export function AuthGate({ config }: AuthGateProps) {
  const supabase = useMemo(
    () =>
      config.url && config.publishableKey
        ? createClient(config.url, config.publishableKey)
        : null,
    [config.publishableKey, config.url],
  );
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(Boolean(supabase));

  useEffect(() => {
        if (!supabase) return;

    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setCheckingSession(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, [supabase]);

  if (!supabase) return <MissingAuthConfiguration />;
  if (checkingSession) return <AuthLoading />;
  if (!session) return <SignIn supabase={supabase} />;

  return (
    <NoteFlowApp
      user={userForApp(session.user)}
      getAccessToken={getAccessToken}
      onSignOut={signOut}
    />
  );
}

function SignIn({ supabase }: { supabase: SupabaseClient }) {
  const { t } = useLocale();
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const startGoogleSignIn = async () => {
    setPending(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: new URL("/account", window.location.origin).toString(),
      },
    });
    if (signInError) {
      setError(signInError.message);
      setPending(false);
    }
  };

  const requestEmailCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setPending(true);
    setError("");
    setMessage("");
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: true },
    });
    setPending(false);

    if (sendError) {
      setError(sendError.message);
      return;
    }

    setEmail(normalizedEmail);
    setStep("code");
    setMessage(t(`A verification code was sent to ${normalizedEmail}`, `验证码已发送到 ${normalizedEmail}`));
  };

  const sendEmailCode = (event: FormEvent) => {
    event.preventDefault();
    void requestEmailCode();
  };

  const verifyEmailCode = async (event: FormEvent) => {
    event.preventDefault();
    const token = code.replace(/\s/g, "");
    if (!token) return;

    setPending(true);
    setError("");
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    setPending(false);
    if (verifyError) setError(verifyError.message);
  };

  const returnToEmail = () => {
    setStep("email");
    setCode("");
    setMessage("");
    setError("");
  };

  return (
    <main className="auth-page">
      <LanguageSwitch className="auth-language-switch" />
      <section className="auth-card" aria-labelledby="signin-title">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">N</span>
          <div>
            <strong>NoteFlow</strong>
            <span>Don&apos;t plan. Just flow.</span>
          </div>
        </div>

        <div className="auth-intro">
          <p className="eyebrow">{t("Your private learning workspace", "你的私人学习空间")}</p>
          <h1 id="signin-title">{t("Continue your Flow", "继续你的 Flow")}</h1>
          <p>{t(
            "Sign-in only identifies whose notes these are. Learning data stays in NoteFlow's separate database.",
            "登录只用来识别“这是谁的笔记”。学习数据仍保存在 NoteFlow 的独立数据库中。",
          )}</p>
        </div>

        <button
          className="google-signin"
          type="button"
          onClick={startGoogleSignIn}
          disabled={pending}
        >
          <GoogleIcon />
          {t("Continue with Google", "使用 Google 继续")}
        </button>

        <div className="auth-divider"><span>{t("or use an email code", "或使用邮箱验证码")}</span></div>

        {step === "email" ? (
          <form className="auth-form" onSubmit={sendEmailCode}>
            <label htmlFor="signin-email">{t("Email", "邮箱")}</label>
            <input
              id="signin-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={pending}
              required
            />
            <button className="email-code-button" type="submit" disabled={pending}>
              {pending ? t("Sending…", "正在发送…") : t("Send verification code", "发送验证码")}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={verifyEmailCode}>
            <div className="auth-code-heading">
              <label htmlFor="signin-code">{t("Enter the code from your email", "输入邮箱中的验证码")}</label>
              <button type="button" onClick={returnToEmail}>{t("Change email", "更换邮箱")}</button>
            </div>
            <input
              id="signin-code"
              className="auth-code-input"
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              placeholder="000000"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              disabled={pending}
              autoFocus
              required
            />
            <button className="email-code-button" type="submit" disabled={pending}>
              {pending ? t("Verifying…", "正在验证…") : t("Verify and enter", "验证并进入")}
            </button>
            <button
              className="resend-code-button"
              type="button"
              onClick={() => void requestEmailCode()}
              disabled={pending}
            >
              {t("Resend code", "重新发送验证码")}
            </button>
          </form>
        )}

        {message && <p className="auth-message" role="status">{message}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}

        <p className="auth-footnote">
          {t(
            "No password is created. Google or email is only the key; notes, goals, skill state, and learning history are isolated by account.",
            "不创建密码。Google 或邮箱只是钥匙；笔记、目标、Skill State 与学习记录按账号隔离。",
          )}
        </p>
      </section>
    </main>
  );
}

function MissingAuthConfiguration() {
  const { t } = useLocale();

  return (
    <main className="auth-page">
      <LanguageSwitch className="auth-language-switch" />
      <section className="auth-card" aria-labelledby="signin-title">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">N</span>
          <div>
            <strong>NoteFlow</strong>
            <span>Don&apos;t plan. Just flow.</span>
          </div>
        </div>

        <div className="auth-intro">
          <p className="eyebrow">{t("Optional personal account", "可选的个人账户")}</p>
          <h1 id="signin-title">{t("Guest learning is ready.", "访客学习已经可以使用。")}</h1>
          <p>{t(
            "Personal account sign-in is not enabled on this deployment. It is not required for the public hackathon experience.",
            "此部署尚未启用个人账户登录。公开 Hackathon 体验不需要登录。",
          )}</p>
        </div>

        <div className="auth-setup-notice">
          <strong>{t("Nothing is blocked", "不会影响体验")}</strong>
          <span>{t(
            "The guest workspace keeps learning state in this browser and connects to the same live Google Cloud Agent.",
            "访客学习空间会把学习状态保存在当前浏览器，并连接同一个 Google Cloud Agent。",
          )}</span>
        </div>

        <a className="email-code-button auth-guest-link" href="/demo">
          {t("Enter guest learning", "进入访客学习")}
        </a>
        <a className="resend-code-button auth-guest-link" href="/hackathon">
          {t("Return to the hackathon entry", "返回参赛页面")}
        </a>
      </section>
    </main>
  );
}

function AuthLoading() {
  const { t } = useLocale();

  return (
    <main className="auth-page">
      <LanguageSwitch className="auth-language-switch" />
      <section className="auth-card auth-loading-card" aria-live="polite">
        <span className="auth-loader" aria-hidden="true" />
        <p>{t("Opening your NoteFlow…", "正在打开你的 NoteFlow…")}</p>
      </section>
    </main>
  );
}

function userForApp(user: User) {
  const displayName =
    metadataString(user.user_metadata, "full_name") ??
    metadataString(user.user_metadata, "name") ??
    user.email ??
    "NoteFlow learner";

  return {
    id: user.id,
    displayName,
    email: user.email ?? "",
    authProvider:
      metadataString(user.app_metadata, "provider") ??
      user.identities?.[0]?.provider ??
      "email",
  };
}

function metadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.3h5.4a4.6 4.6 0 0 1-2 3v2.8h3.3c1.9-1.8 2.9-4.4 2.9-7.9Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.8c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.9A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.5 13.7a6 6 0 0 1 0-3.8V7H3.1a10 10 0 0 0 0 9.6l3.4-2.9Z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.9.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 3.1 7l3.4 2.9A5.9 5.9 0 0 1 12 5.9Z" />
    </svg>
  );
}
