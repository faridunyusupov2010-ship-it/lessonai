"use client";

import { Check, X } from "lucide-react";
import type { QuestionResult } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "./ui";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function fmt(r: QuestionResult, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (r.type === "multiple_choice" && typeof v === "number") return `${LETTERS[v]}) ${r.options?.[v] ?? ""}`;
  if (r.type === "true_false" && typeof v === "boolean") return v ? "True" : "False";
  if (Array.isArray(v)) return v.join(" / ");
  return String(v);
}

export function ResultReview({
  results,
  perspective,
}: {
  results: QuestionResult[];
  perspective: "student" | "teacher";
}) {
  const { t } = useI18n();
  return (
    <ol className="sheet">
      {results.map((r, i) => {
        const given = fmt(r, r.response);
        return (
          <li
            key={r.question_id}
            className="relative border-b border-line/70 py-5 pl-14 pr-4 last:border-b-0 sm:pl-[4.5rem] sm:pr-8"
          >
            <span className="absolute left-0 top-5 w-10 pr-2 text-right font-sheet text-[19px] leading-relaxed text-mute sm:w-14 sm:pr-3">
              {i + 1}
            </span>
            <p className="font-sheet text-[18px] leading-relaxed">{r.prompt}</p>
            <p
              className={cn(
                "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold",
                r.is_correct ? "bg-ok/10 text-ok" : "bg-alert/10 text-alert",
              )}
            >
              {r.is_correct ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
              {r.is_correct ? t("st_correct") : t("st_wrong")}
            </p>
            <p className="mt-2 text-sm">
              <span className="text-mute">
                {perspective === "student" ? t("st_your_answer") : t("res_student_answer")}:
              </span>{" "}
              <span className="font-sheet text-[16px]">{given || <em className="text-mute">{t("st_no_answer")}</em>}</span>
            </p>
            {!r.is_correct && (
              <p className="mt-1 text-sm">
                <span className="text-mute">{t("correct_answer")}:</span>{" "}
                <span className="mark font-sheet text-[16px]">{fmt(r, r.correct_answer)}</span>
              </p>
            )}
            {r.explanation && <p className="mt-2 text-sm text-mute">{r.explanation}</p>}
          </li>
        );
      })}
    </ol>
  );
}
