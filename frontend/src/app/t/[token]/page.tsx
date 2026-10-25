"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, studentApi, type PublicTest, type SubmitOut } from "@/lib/api";
import { useI18n, type Lang } from "@/lib/i18n";
import { Button, ErrorNote, FullSpinner, Input, cn } from "@/components/ui";
import { ResultReview } from "@/components/ResultReview";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
type Answers = Record<string, number | boolean | string>;
type Stage = "loading" | "missing" | "intro" | "taking" | "done";

export default function StudentPage() {
  const { token } = useParams<{ token: string }>();
  const { t, lang, setLang, errText } = useI18n();
  const [test, setTest] = useState<PublicTest | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<SubmitOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    studentApi
      .getTest(token)
      .then((x) => {
        setTest(x);
        setStage("intro");
      })
      .catch(() => setStage("missing"));
  }, [token]);

  function setAns(id: string, v: number | boolean | string) {
    setAnswers((prev) => {
      const next = { ...prev };
      if (v === "") delete next[id];
      else next[id] = v;
      return next;
    });
  }

  async function submit() {
    if (!test) return;
    const missing = test.questions.length - Object.keys(answers).length;
    if (missing > 0 && !window.confirm(t("st_confirm_unanswered", { n: missing }))) return;
    setBusy(true);
    setError(null);
    try {
      const r = await studentApi.submit(token, {
        student_name: name.trim(),
        answers: Object.entries(answers).map(([question_id, response]) => ({ question_id, response })),
      });
      setResult(r);
      setStage("done");
      window.scrollTo({ top: 0 });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setStage("missing");
      else setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  if (stage === "loading") return <FullSpinner />;

  const header = (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
        <p className="text-lg font-extrabold tracking-tight">
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
    </header>
  );

  if (stage === "missing" || !test) {
    return (
      <div className="min-h-screen">
        {header}
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <p className="text-lg font-semibold">{t("st_not_found")}</p>
        </main>
      </div>
    );
  }

  const total = test.questions.length;
  const answered = Object.keys(answers).length;

  return (
    <div className="min-h-screen pb-24">
      {header}
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        {stage === "intro" && (
          <div className="mx-auto max-w-md space-y-6 pt-4">
            <div>
              <h1 className="font-sheet text-3xl font-semibold leading-tight">{test.title}</h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-mute">
                <span className="rounded bg-pen-soft px-2 py-0.5 font-bold text-pen">{test.level}</span>
                <span>{test.topic}</span>
                <span>{t("questions_count", { n: total })}</span>
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStage("taking");
              }}
              className="space-y-4"
            >
              <label htmlFor="name" className="block text-sm font-semibold">
                {t("st_your_name")}
              </label>
              <Input id="name" required maxLength={100} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              <Button type="submit" className="w-full">
                {t("st_start")}
              </Button>
            </form>
          </div>
        )}

        {stage === "taking" && (
          <>
            <h1 className="font-sheet text-2xl font-semibold">{test.title}</h1>
            <ol className="sheet">
              {test.questions.map((q, i) => (
                <li
                  key={q.id}
                  className="relative border-b border-line/70 py-6 pl-14 pr-4 last:border-b-0 sm:pl-[4.5rem] sm:pr-8"
                >
                  <span className="absolute left-0 top-6 w-10 pr-2 text-right font-sheet text-[19px] leading-relaxed text-mute sm:w-14 sm:pr-3">
                    {i + 1}
                  </span>
                  <p className="font-sheet text-[19px] leading-relaxed">{q.prompt}</p>

                  {q.type === "multiple_choice" && (
                    <div role="radiogroup" className="mt-3 space-y-2">
                      {(q.options ?? []).map((o, j) => (
                        <label
                          key={j}
                          className={cn(
                            "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 font-sheet text-[17px]",
                            answers[q.id] === j ? "border-pen bg-pen-soft" : "border-line hover:bg-paper",
                          )}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={answers[q.id] === j}
                            onChange={() => setAns(q.id, j)}
                            className="h-4 w-4 accent-[#2243B6]"
                          />
                          <span className="text-mute">{LETTERS[j]}</span>
                          {o}
                        </label>
                      ))}
                    </div>
                  )}

                  {q.type === "true_false" && (
                    <div role="radiogroup" className="mt-3 flex gap-2">
                      {[true, false].map((v) => (
                        <label
                          key={String(v)}
                          className={cn(
                            "flex min-h-11 flex-1 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 font-sheet text-[17px] sm:flex-none sm:px-6",
                            answers[q.id] === v ? "border-pen bg-pen-soft" : "border-line hover:bg-paper",
                          )}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={answers[q.id] === v}
                            onChange={() => setAns(q.id, v)}
                            className="h-4 w-4 accent-[#2243B6]"
                          />
                          {v ? "True" : "False"}
                        </label>
                      ))}
                    </div>
                  )}

                  {q.type === "fill_blank" && (
                    <Input
                      value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""}
                      onChange={(e) => setAns(q.id, e.target.value)}
                      placeholder={t("st_fill_ph")}
                      aria-label={t("st_fill_ph")}
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      className="mt-3 font-sheet text-[17px]"
                    />
                  )}
                </li>
              ))}
            </ol>
            {error && <ErrorNote>{error}</ErrorNote>}

            <div className="fixed inset-x-0 bottom-0 border-t border-line bg-white/95 backdrop-blur">
              <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
                <p className="text-sm font-semibold text-mute">{t("st_answered", { n: answered, max: total })}</p>
                <Button onClick={submit} loading={busy}>
                  {t("st_submit")}
                </Button>
              </div>
            </div>
          </>
        )}

        {stage === "done" && result && (
          <>
            <div className="rounded-lg border border-line bg-white p-8 text-center">
              <p className="text-sm font-semibold text-mute">{t("st_result")}</p>
              <p className="mt-2 text-5xl font-extrabold tracking-tight">
                {Number(result.score.toFixed(1))} / {Number(result.max_score.toFixed(1))}
              </p>
              <p className="mt-2 text-lg font-semibold text-pen">
                {result.max_score > 0 ? Math.round((result.score / result.max_score) * 100) : 0}%
              </p>
            </div>
            <h2 className="text-xl font-bold">{t("st_review")}</h2>
            <ResultReview results={result.results} perspective="student" />
          </>
        )}
      </main>
    </div>
  );
}
