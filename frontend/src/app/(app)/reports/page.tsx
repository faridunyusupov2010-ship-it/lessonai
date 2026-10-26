"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { reportsApi, type StudentSummary, type TopicStat } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { ErrorNote, cn } from "@/components/ui";

const barColor = (p: number) => (p >= 75 ? "bg-ok" : p >= 50 ? "bg-marker" : "bg-alert");

export default function ReportsPage() {
  const { t, errText } = useI18n();
  const [students, setStudents] = useState<StudentSummary[] | null>(null);
  const [selected, setSelected] = useState("");
  const [topics, setTopics] = useState<TopicStat[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reportsApi
      .students()
      .then(setStudents)
      .catch((e) => setError(errText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    setTopics(null);
    reportsApi
      .topics(selected || undefined)
      .then((x) => alive && setTopics(x))
      .catch((e) => alive && setError(errText(e)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const empty = students !== null && students.length === 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight">{t("reports_title")}</h1>
      {error && <ErrorNote>{error}</ErrorNote>}

      {empty && (
        <div className="rounded-lg border border-dashed border-line bg-white px-6 py-14 text-center text-mute">
          {t("reports_empty")}
        </div>
      )}

      {students && students.length > 0 && (
        <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
          <section aria-label={t("reports_students")} className="space-y-2">
            <h2 className="text-sm font-semibold text-mute">{t("reports_students")}</h2>
            <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
              {[{ name: "", attempts: 0, percent: null, last_at: null } as StudentSummary, ...students].map((s) => {
                const all = s.name === "";
                const on = selected.toLowerCase() === s.name.toLowerCase();
                return (
                  <button
                    key={s.name || "__all"}
                    type="button"
                    onClick={() => setSelected(s.name)}
                    aria-pressed={on}
                    className={cn("flex w-full items-center gap-3 px-4 py-3 text-left", on ? "bg-pen-soft" : "hover:bg-paper")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{all ? t("reports_all") : s.name}</span>
                      {!all && <span className="block text-xs text-mute">{t("reports_attempts", { n: s.attempts })}</span>}
                    </span>
                    {!all && s.percent !== null && <span className="text-sm font-bold">{Math.round(s.percent)}%</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-mute">{t("reports_note")}</p>
          </section>

          <section aria-label={t("reports_topics")} className="space-y-2">
            <h2 className="text-sm font-semibold text-mute">{t("reports_topics")}</h2>
            <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
              {topics === null && <p className="px-5 py-6 text-mute">...</p>}
              {topics?.map((x) => (
                <div key={x.topic} className="flex items-center gap-4 px-4 py-3 sm:px-5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{x.topic}</span>
                    <span className="block text-xs text-mute">{t("of_n", { n: x.correct, max: x.total })}</span>
                  </span>
                  <div className="h-2 w-28 shrink-0 rounded-full bg-ink/10" aria-hidden>
                    <div className={cn("h-2 rounded-full", barColor(x.percent))} style={{ width: `${Math.max(x.percent, 3)}%` }} />
                  </div>
                  <span className="w-12 text-right text-sm font-bold">{Math.round(x.percent)}%</span>
                  {x.percent < 60 && (
                    <Link
                      href={`/tests/new?topic=${encodeURIComponent(x.topic)}`}
                      className="shrink-0 rounded-md border border-line px-2.5 py-1 text-xs font-semibold hover:bg-paper"
                    >
                      {t("reports_practice")}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
