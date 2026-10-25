"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { Question, QuestionInput } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Button, ErrorNote, Field, Input, Textarea, cn } from "./ui";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

interface Props {
  index: number;
  question: Question;
  onSave: (body: QuestionInput) => Promise<void>;
  onRemove: () => Promise<void>;
}

export function QuestionBlock({ index, question: q, onSave, onRemove }: Props) {
  const { t, errText } = useI18n();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [tag, setTag] = useState("");
  const [expl, setExpl] = useState("");
  const [opts, setOpts] = useState<string[]>([]);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [tf, setTf] = useState(true);
  const [answers, setAnswers] = useState("");

  function startEdit() {
    setPrompt(q.prompt);
    setTag(q.topic_tag);
    setExpl(q.explanation ?? "");
    setOpts(q.options ?? ["", "", "", ""]);
    setCorrectIdx(typeof q.correct_answer === "number" ? q.correct_answer : 0);
    setTf(q.correct_answer === true);
    setAnswers(Array.isArray(q.correct_answer) ? q.correct_answer.join("\n") : "");
    setErr(null);
    setEditing(true);
  }

  async function save() {
    const p = prompt.trim();
    const tg = tag.trim();
    if (!p || !tg) {
      setErr(t("err_fill_all"));
      return;
    }
    let body: QuestionInput;
    if (q.type === "multiple_choice") {
      const o = opts.map((x) => x.trim());
      if (o.some((x) => !x)) {
        setErr(t("err_fill_all"));
        return;
      }
      body = { type: q.type, topic_tag: tg, prompt: p, options: o, correct_answer: correctIdx, explanation: expl.trim() || null };
    } else if (q.type === "true_false") {
      body = { type: q.type, topic_tag: tg, prompt: p, options: null, correct_answer: tf, explanation: expl.trim() || null };
    } else {
      const list = answers.split("\n").map((x) => x.trim()).filter(Boolean);
      if (!list.length) {
        setErr(t("err_fill_all"));
        return;
      }
      body = { type: q.type, topic_tag: tg, prompt: p, options: null, correct_answer: list, explanation: expl.trim() || null };
    }
    setBusy(true);
    setErr(null);
    try {
      await onSave(body);
      setEditing(false);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(t("confirm_remove_q"))) return;
    setBusy(true);
    try {
      await onRemove();
    } catch (e) {
      setErr(errText(e));
      setBusy(false);
    }
  }

  const shell = "relative border-b border-line/70 py-6 pl-14 pr-4 last:border-b-0 sm:pl-[4.5rem] sm:pr-8";
  const number = (
    <span className="absolute left-0 top-6 w-10 pr-2 text-right font-sheet text-[19px] leading-relaxed text-mute sm:w-14 sm:pr-3">
      {index}
    </span>
  );

  if (editing) {
    return (
      <li className={cn(shell, "bg-pen-soft/40")}>
        {number}
        <div className="space-y-4">
          <Field label={t("prompt")} htmlFor={`p-${q.id}`}>
            <Textarea id={`p-${q.id}`} rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="font-sheet text-[17px]" />
          </Field>

          {q.type === "multiple_choice" && (
            <fieldset className="space-y-2">
              <legend className="mb-1.5 text-sm font-semibold">
                {t("options")} <span className="font-normal text-mute">({t("correct_answer")})</span>
              </legend>
              {opts.map((o, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name={`c-${q.id}`}
                    checked={correctIdx === i}
                    onChange={() => setCorrectIdx(i)}
                    aria-label={`${t("correct_answer")} ${LETTERS[i]}`}
                    className="h-4 w-4 accent-[#2243B6]"
                  />
                  <span className="w-4 font-sheet text-mute">{LETTERS[i]}</span>
                  <Input
                    value={o}
                    onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))}
                    aria-label={`${t("options")} ${LETTERS[i]}`}
                    className="font-sheet text-[17px]"
                  />
                </div>
              ))}
            </fieldset>
          )}

          {q.type === "true_false" && (
            <fieldset className="flex gap-6">
              <legend className="mb-1.5 text-sm font-semibold">{t("correct_answer")}</legend>
              {[true, false].map((v) => (
                <label key={String(v)} className="flex items-center gap-2 font-sheet text-[17px]">
                  <input type="radio" name={`tf-${q.id}`} checked={tf === v} onChange={() => setTf(v)} className="h-4 w-4 accent-[#2243B6]" />
                  {v ? "True" : "False"}
                </label>
              ))}
            </fieldset>
          )}

          {q.type === "fill_blank" && (
            <Field label={t("accepted_answers")} htmlFor={`a-${q.id}`}>
              <Textarea id={`a-${q.id}`} rows={2} value={answers} onChange={(e) => setAnswers(e.target.value)} className="font-sheet text-[17px]" />
            </Field>
          )}

          <Field label={t("explanation")} htmlFor={`e-${q.id}`}>
            <Textarea id={`e-${q.id}`} rows={2} value={expl} onChange={(e) => setExpl(e.target.value)} />
          </Field>
          <Field label={t("topic_tag")} htmlFor={`t-${q.id}`}>
            <Input id={`t-${q.id}`} value={tag} onChange={(e) => setTag(e.target.value)} />
          </Field>

          {err && <ErrorNote>{err}</ErrorNote>}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} loading={busy}>
              {t("save")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className={shell}>
      {number}
      <p className="font-sheet text-[19px] leading-relaxed">{q.prompt}</p>

      {q.type === "multiple_choice" && q.options && (
        <ol className="mt-3 space-y-1.5 font-sheet text-[17px]">
          {q.options.map((o, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-5 text-mute">{LETTERS[i]}.</span>
              <span className={cn(q.correct_answer === i && "mark")}>{o}</span>
            </li>
          ))}
        </ol>
      )}

      {q.type === "true_false" && (
        <ul className="mt-3 space-y-1.5 font-sheet text-[17px]">
          {[true, false].map((v) => (
            <li key={String(v)}>
              <span className={cn(q.correct_answer === v && "mark")}>{v ? "True" : "False"}</span>
            </li>
          ))}
        </ul>
      )}

      {q.type === "fill_blank" && Array.isArray(q.correct_answer) && (
        <p className="mt-3 font-sheet text-[17px]">
          <span className="mark">{q.correct_answer.join(" / ")}</span>
        </p>
      )}

      {q.explanation && (
        <p className="mt-3 text-sm text-mute">
          <span className="font-semibold text-ink">{t("explanation")}:</span> {q.explanation}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded bg-paper px-2 py-0.5 text-xs text-mute">{q.topic_tag}</span>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" onClick={startEdit} disabled={busy}>
          <Pencil className="h-4 w-4" aria-hidden />
          {t("edit")}
        </Button>
        <Button size="sm" variant="ghost" onClick={remove} disabled={busy}>
          <Trash2 className="h-4 w-4" aria-hidden />
          {t("remove_q")}
        </Button>
      </div>
      {err && (
        <div className="mt-3">
          <ErrorNote>{err}</ErrorNote>
        </div>
      )}
    </li>
  );
}
