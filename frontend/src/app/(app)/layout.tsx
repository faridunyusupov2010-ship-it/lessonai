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

  const links = [
    { href: "/dashboard", label: t("nav_tests") },
    { href: "/bank", label: t("nav_bank") },
    { href: "/reports", label: t("nav_reports") },
    { href: "/books", label: t("nav_books") },
    ...(teacher.is_admin ? [{ href: "/admin", label: t("nav_admin") }] : []),
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link href="/dashboard" className="text-xl font-extrabold tracking-tight">
            Lesson<span className="mark">AI</span>
          </Link>
          <nav className="ml-2 hidden items-center gap-1 sm:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm font-semibold hover:bg-ink/5">
                {l.label}
              </Link>
            ))}
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
        <nav className="flex gap-1 overflow-x-auto border-t border-line px-3 py-1 sm:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold hover:bg-ink/5">
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
