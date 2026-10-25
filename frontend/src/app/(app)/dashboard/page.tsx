"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
import { api, type TestSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button, ErrorNote, StatusBadge } from "@/components/ui";

const FREE_LIMIT = 20;

export default function DashboardPage() {
  const { t, lang, errText } = useI18n();
  const { teacher } = useAuth();
  const [tests, setTests] = useState<TestSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .listTests()
      .then(setTests)
      .catch((e) => setError(errText(e)));
  }, [errText]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = new Date();
  const usedThisMonth =
    tests?.filter((x) => {
      const d = new Date(x.created_at);
      return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
    }).length ?? 0;
  const locale = lang === "tg" ? "tg-TJ" : lang;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t("my_tests")}</h1>
          {teacher?.plan === "free" && tests && (
            <p className="mt-1 text-sm text-mute">{t("usage", { n: usedThisMonth, max: FREE_LIMIT })}</p>
          )}
        </div>
      </div>

      {error && (
        <div className="space-y-3">
          <ErrorNote>
            {t("load_error")} {error}
          </ErrorNote>
          <Button variant="secondary" size="sm" onClick={load}>
            {t("retry")}
          </Button>
        </div>
      )}

      {!error && tests === null && (
        <div className="divide-y divide-line rounded-lg border border-line bg-white" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-11 w-11 animate-pulse rounded bg-ink/5" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 animate-pulse rounded bg-ink/5" />
                <div className="h-3 w-1/5 animate-pulse rounded bg-ink/5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {tests && tests.length === 0 && (
        <div className="rounded-lg border border-dashed border-line bg-white px-6 py-14 text-center">
          <FileText className="mx-auto h-8 w-8 text-mute" aria-hidden />
          <h2 className="mt-4 text-xl font-bold">{t("empty_title")}</h2>
          <p className="mx-auto mt-1 max-w-sm text-mute">{t("empty_text")}</p>
          <Link
            href="/tests/new"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-pen px-5 font-semibold text-white hover:bg-pen-dark"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("create_first")}
          </Link>
        </div>
      )}

      {tests && tests.length > 0 && (
        <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
          {tests.map((x) => (
            <Link
              key={x.id}
              href={`/tests/${x.id}`}
              className="flex items-center gap-4 px-4 py-4 hover:bg-pen-soft/50 sm:px-5"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded bg-pen-soft font-bold text-pen">
                {x.level}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{x.title}</span>
                <span className="block truncate text-sm text-mute">{x.topic}</span>
              </span>
              <span className="hidden text-sm text-mute sm:block">{t("questions_count", { n: x.question_count })}</span>
              <StatusBadge status={x.status} />
              <span className="hidden w-28 text-right text-sm text-mute md:block">
                {new Date(x.created_at).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
