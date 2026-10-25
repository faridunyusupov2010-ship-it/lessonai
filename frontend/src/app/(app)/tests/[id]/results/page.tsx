"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { resultsApi, type AttemptDetail, type TestResults } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { ErrorNote, FullSpinner, cn } from "@/components/ui";
import { ResultReview } from "@/components/ResultReview";

function barColor(pct: number) {
  return pct >= 75 ? "bg-ok" : pct >= 50 ? "bg-marker" : "bg-alert";
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-2 w-24 shrink-0 rounded-full bg-ink/10" aria-hidden>
      <div className={cn("h-2 rounded-full", barColor(pct))} style={{ width: `${Math.max(pct, 3)}%` }} />
    </div>
  );
}

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang, errText } = useI18n();
  const [data, setData] = useState<TestResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, AttemptDetail>>({});

  useEffect(() => {
    resultsApi
      .forTest(id)
      .then(setData)
      .catch((e) => setError(errText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function toggle(attemptId: string) {
    if (open === attemptId) {
      setOpen(null);
      return;
    }
    setOpen(attemptId);
    if (!details[attemptId]) {
      try {
        const d = await resultsApi.attempt(attemptId);
        setDetails((p) => ({ ...p, [attemptId]: d }));
      } catch (e) {
        setError(errText(e));
      }
    }
  }

  if (error && !data) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <FullSpinner />;

  const locale = lang === "tg" ? "tg-TJ" : lang;
  const hardest = [...data.questions].sort((a, b) => {
    const pa = a.total ? a.correct / a.total : 2;
    const pb = b.total ? b.correct / b.total : 2;
    return pa - pb;
  });

  return (
    <div className="space-y-6">
      <Link href={`/tests/${id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-mute hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {data.title}
      </Link>

      <h1 className="text-3xl font-extrabold tracking-tight">{t("results_title")}</h1>
      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-white p-5">
          <p className="text-sm text-mute">{t("results_count")}</p>
          <p className="mt-1 text-4xl font-extrabold">{data.attempts.length}</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-5">
          <p className="text-sm text-mute">{t("results_avg")}</p>
          <p className="mt-1 text-4xl font-extrabold">
            {data.average_percent === null ? "-" : `${Math.round(data.average_percent)}%`}
          </p>
        </div>
      </div>

      {data.attempts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-white px-6 py-12 text-center text-mute">
          {t("results_empty")}
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t("results_students")}</h2>
            <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
              {data.attempts.map((a) => {
                const pct = a.max_score ? Math.round(((a.score ?? 0) / a.max_score) * 100) : 0;
                const isOpen = open === a.id;
                return (
                  <div key={a.id}>
                    <button
                      type="button"
                      onClick={() => toggle(a.id)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-pen-soft/50 sm:px-5"
                    >
                      <span className="min-w-0 flex-1 truncate font-semibold">{a.student_name}</span>
                      <span className="hidden text-sm text-mute md:block">
                        {a.submitted_at &&
                          new Date(a.submitted_at).toLocaleString(locale, {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                      </span>
                      <Bar pct={pct} />
                      <span className="w-20 text-right text-sm font-bold">
                        {Number((a.score ?? 0).toFixed(1))} / {Number((a.max_score ?? 0).toFixed(1))}
                      </span>
                      <ChevronDown className={cn("h-4 w-4 text-mute transition-transform", isOpen && "rotate-180")} aria-hidden />
                    </button>
                    {isOpen && (
                      <div className="bg-paper px-3 py-4 sm:px-5">
                        {details[a.id] ? (
                          <ResultReview results={details[a.id].results} perspective="teacher" />
                        ) : (
                          <p className="text-sm text-mute">...</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t("results_hard")}</h2>
            <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
              {hardest.map((q) => {
                const pct = q.total ? Math.round((q.correct / q.total) * 100) : 0;
                return (
                  <div key={q.question_id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
                    <span className="w-6 text-right font-sheet text-lg text-mute">{q.position}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-sheet text-[16px]">{q.prompt}</span>
                      <span className="block truncate text-xs text-mute">{q.topic_tag}</span>
                    </span>
                    <Bar pct={pct} />
                    <span className="w-16 text-right text-sm font-bold">{t("of_n", { n: q.correct, max: q.total })}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
