"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApi, type AdminStats, type AdminTeacher, type LLMProvider, type Plan } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n, type Key } from "@/lib/i18n";
import { ErrorNote, Input, cn } from "@/components/ui";

export default function AdminPage() {
  const { t, lang, errText } = useI18n();
  const { teacher } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [rows, setRows] = useState<AdminTeacher[] | null>(null);
  const [search, setSearch] = useState("");
  const [providers, setProviders] = useState<LLMProvider[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locale = lang === "tg" ? "tg-TJ" : lang;

  useEffect(() => {
    if (!teacher?.is_admin) return;
    adminApi.stats().then(setStats).catch((e) => setError(errText(e)));
    adminApi.teachers().then(setRows).catch((e) => setError(errText(e)));
    adminApi.llm().then(setProviders).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher?.is_admin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!rows) return null;
    return q ? rows.filter((r) => r.email.toLowerCase().includes(q) || r.full_name.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  async function changePlan(id: string, plan: Plan) {
    const before = rows;
    setRows((cur) => cur && cur.map((r) => (r.id === id ? { ...r, plan } : r)));
    try {
      await adminApi.setPlan(id, plan);
      adminApi.stats().then(setStats).catch(() => {});
    } catch (e) {
      setRows(before);
      setError(errText(e));
    }
  }

  if (!teacher?.is_admin) return <ErrorNote>403</ErrorNote>;

  const cards: { key: Key; value: number | undefined }[] = [
    { key: "admin_teachers", value: stats?.teachers },
    { key: "admin_pro", value: stats?.pro_teachers },
    { key: "admin_new_week", value: stats?.new_teachers_7d },
    { key: "admin_tests", value: stats?.tests },
    { key: "admin_tests_today", value: stats?.tests_today },
    { key: "admin_attempts", value: stats?.attempts },
  ];
  const date = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : "-";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight">{t("admin_title")}</h1>
      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.key} className="rounded-lg border border-line bg-white p-4">
            <p className="text-sm text-mute">{t(c.key)}</p>
            <p className="mt-1 text-3xl font-extrabold">{c.value ?? "-"}</p>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="text-sm font-semibold">{t("admin_llm")}</h2>
        {providers && providers.length === 0 && <p className="mt-2 text-sm text-mute">{t("admin_llm_none")}</p>}
        <ol className="mt-2 divide-y divide-line">
          {providers?.map((p, i) => (
            <li key={p.name} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-5 text-mute">{i + 1}</span>
              <span className="font-semibold">{p.name}</span>
              <span className="min-w-0 flex-1 truncate text-mute">{p.model}</span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  p.cooling_seconds > 0 ? "bg-marker/50 text-ink" : "bg-ok/10 text-ok",
                )}
              >
                {p.cooling_seconds > 0 ? t("admin_llm_cooling", { n: p.cooling_seconds }) : t("admin_llm_ready")}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin_search")} aria-label={t("admin_search")} />

      <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
        {filtered === null && <p className="px-5 py-6 text-mute">...</p>}
        {filtered?.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1 basis-56">
              <p className="truncate font-semibold">{r.full_name}</p>
              <p className="truncate text-sm text-mute">{r.email}</p>
            </div>
            <div className="text-sm text-mute">
              <p>
                {t("admin_tests")}: <span className="font-bold text-ink">{r.tests}</span>
              </p>
              <p>
                {t("admin_attempts")}: <span className="font-bold text-ink">{r.attempts}</span>
              </p>
            </div>
            <div className="hidden text-sm text-mute md:block">
              <p>
                {t("admin_joined")}: {date(r.created_at)}
              </p>
              <p>
                {t("admin_last")}: {date(r.last_test_at)}
              </p>
            </div>
            <select
              aria-label={t("admin_plan")}
              value={r.plan}
              onChange={(e) => changePlan(r.id, e.target.value as Plan)}
              className={cn(
                "h-10 rounded-md border px-3 text-sm font-semibold",
                r.plan === "pro" ? "border-ok/40 bg-ok/10 text-ok" : "border-line bg-white",
              )}
            >
              <option value="free">free</option>
              <option value="pro">pro</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
