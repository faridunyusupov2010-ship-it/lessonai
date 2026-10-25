"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n, type Lang } from "@/lib/i18n";
import { Button, ErrorNote, Field, Input } from "./ui";
import { LangSwitch } from "./LangSwitch";

function SampleSheet() {
  return (
    <div className="sheet w-full max-w-md" aria-hidden>
      <ol className="font-sheet">
        <li className="relative border-b border-line/70 py-5 pl-[4.5rem] pr-6">
          <span className="absolute left-0 w-14 pr-3 text-right text-lg text-mute">1</span>
          <p className="text-lg leading-relaxed">She _____ in Dushanbe since 2019.</p>
          <p className="mt-2 text-base text-mute">
            <span className="mark text-ink">has lived</span>
          </p>
        </li>
        <li className="relative py-5 pl-[4.5rem] pr-6">
          <span className="absolute left-0 w-14 pr-3 text-right text-lg text-mute">2</span>
          <p className="text-lg leading-relaxed">I haven&apos;t seen him _____ Monday.</p>
          <ul className="mt-2 space-y-1 text-base text-mute">
            <li>A. for</li>
            <li>
              B. <span className="mark text-ink">since</span>
            </li>
            <li>C. during</li>
          </ul>
        </li>
      </ol>
    </div>
  );
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { t, lang, setLang, errText } = useI18n();
  const { teacher, login, register } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";

  useEffect(() => {
    if (teacher) router.replace("/dashboard");
  }, [teacher, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isRegister) {
        await register({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          ui_language: lang,
        });
      } else {
        await login(email.trim(), password);
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="hidden flex-col justify-between bg-pen-soft px-12 py-14 lg:flex">
        <p className="text-2xl font-extrabold tracking-tight">
          Lesson<span className="mark">AI</span>
        </p>
        <div className="space-y-8">
          <h1 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight">{t("tagline")}</h1>
          <SampleSheet />
        </div>
        <span />
      </aside>

      <main className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <p className="text-xl font-extrabold tracking-tight lg:invisible">
            Lesson<span className="mark">AI</span>
          </p>
          <select
            aria-label="Language"
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            className="h-9 rounded-md border border-line bg-white px-2 text-sm"
          >
            <option value="tg">Тоҷикӣ</option>
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </div>

        <form onSubmit={submit} className="m-auto w-full max-w-sm space-y-5 py-10">
          <h2 className="text-3xl font-extrabold tracking-tight">
            {isRegister ? t("register_title") : t("login_title")}
          </h2>
          {isRegister && (
            <Field label={t("full_name")} htmlFor="full_name">
              <Input
                id="full_name"
                required
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </Field>
          )}
          <Field label={t("email")} htmlFor="email">
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label={t("password")} htmlFor="password" hint={isRegister ? t("password_hint") : undefined}>
            <Input
              id="password"
              type="password"
              required
              minLength={isRegister ? 8 : undefined}
              autoComplete={isRegister ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" loading={busy} className="w-full">
            {isRegister ? t("register_btn") : t("login_btn")}
          </Button>
          <p className="text-sm text-mute">
            {isRegister ? t("have_account") : t("no_account")}{" "}
            <Link
              href={isRegister ? "/login" : "/register"}
              className="font-semibold text-pen underline-offset-2 hover:underline"
            >
              {isRegister ? t("go_login") : t("go_register")}
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
