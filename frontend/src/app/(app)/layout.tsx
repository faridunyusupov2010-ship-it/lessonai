"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogOut, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { FullSpinner } from "@/components/ui";
import { LangSwitch } from "@/components/LangSwitch";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { teacher, loading, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !teacher) router.replace("/login");
  }, [loading, teacher, router]);

  if (loading || !teacher) return <FullSpinner />;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link href="/dashboard" className="text-xl font-extrabold tracking-tight">
            Lesson<span className="mark">AI</span>
          </Link>
          <nav className="ml-2 hidden items-center gap-1 sm:flex">
            <Link href="/dashboard" className="rounded-md px-3 py-2 text-sm font-semibold hover:bg-ink/5">
              {t("nav_tests")}
            </Link>
          </nav>
          <span className="flex-1" />
          <Link
            href="/tests/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-pen px-3 text-sm font-semibold text-white hover:bg-pen-dark"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("nav_new")}
          </Link>
          <LangSwitch />
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            aria-label={t("logout")}
            title={t("logout")}
            className="grid h-9 w-9 place-items-center rounded-md text-mute hover:bg-ink/5 hover:text-ink"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
