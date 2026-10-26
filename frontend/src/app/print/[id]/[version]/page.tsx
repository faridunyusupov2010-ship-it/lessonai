"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { api, type Test } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button, ErrorNote, FullSpinner } from "@/components/ui";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function PrintPage() {
  const { id, version } = useParams<{ id: string; version: string }>();
  const { teacher, loading } = useAuth();
  const { t, lang, errText } = useI18n();
  const router = useRouter();
  const [test, setTest] = useState<Test | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isKey = version === "key";

  useEffect(() => {
    if (!loading && !teacher) router.replace("/login");
  }, [loading, teacher, router]);

  useEffect(() => {
    if (!teacher) return;
    api
      .getTest(id, lang)
      .then(setTest)
      .catch((e) => setError(errText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher, id, lang]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }
  if (!test) return <FullSpinner />;

  return (
    <div className="min-h-screen bg-paper print:bg-white">
      <style>{"@page { size: A4; margin: 18mm; }"}</style>

      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center gap-3 px-4 py-4 print:hidden">
        <Link href={`/tests/${id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-mute hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("back")}
        </Link>
        <span className="flex-1" />
        <p className="text-sm text-mute">{t("export_pdf_hint")}</p>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden />
          {t("print_btn")}
        </Button>
      </div>

      <main className="mx-auto max-w-[210mm] bg-white px-10 py-10 font-sheet text-[12pt] leading-snug shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <h1 className="text-[20pt] font-bold">
          {test.title}
          {isKey && " - Answer key"}
        </h1>
        <p className="mt-1 text-[11pt] text-neutral-600">
          {test.level} | {test.topic}
        </p>

        {!isKey && (
          <p className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
            <span>Name: ______________________</span>
            <span>Date: ____________</span>
            <span>Score: ____ / {test.questions.length}</span>
          </p>
        )}

        <ol className="mt-8 space-y-5">
          {test.questions.map((q, i) => (
            <li key={q.id} className="break-inside-avoid">
              <p>
                <span className="font-bold">{i + 1}.</span> {q.prompt}
              </p>

              {q.type === "multiple_choice" && q.options && (
                <ol className="ml-6 mt-1 space-y-0.5">
                  {q.options.map((o, j) => {
                    const correct = isKey && q.correct_answer === j;
                    return (
                      <li key={j} className={correct ? "font-bold" : undefined}>
                        {LETTERS[j]}) {o}
                        {correct && "  \u2713"}
                      </li>
                    );
                  })}
                </ol>
              )}

              {q.type === "true_false" && (
                <p className="ml-6 mt-1">
                  <span className={isKey && q.correct_answer === true ? "font-bold underline" : undefined}>True</span>
                  {"  /  "}
                  <span className={isKey && q.correct_answer === false ? "font-bold underline" : undefined}>False</span>
                </p>
              )}

              {q.type === "fill_blank" && isKey && Array.isArray(q.correct_answer) && (
                <p className="ml-6 mt-1 font-bold">Answer: {q.correct_answer.join(" / ")}</p>
              )}

              {isKey && q.explanation && (
                <p className="ml-6 mt-1 text-[10.5pt] italic text-neutral-600">{q.explanation}</p>
              )}
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
