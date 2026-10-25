"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3, Check, Copy, FileDown, Printer, Trash2 } from "lucide-react";
import { api, downloadDocx, type QuestionInput, type Test } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Button, ErrorNote, FullSpinner, Input, StatusBadge } from "@/components/ui";
import { QuestionBlock } from "@/components/QuestionBlock";

export default function TestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, errText } = useI18n();
  const [test, setTest] = useState<Test | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    api
      .getTest(id)
      .then((x) => {
        setTest(x);
        setTitle(x.title);
      })
      .catch((e) => setError(errText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error && !test) {
    return (
      <div className="space-y-4">
        <ErrorNote>{error}</ErrorNote>
        <Link href="/dashboard" className="font-semibold text-pen hover:underline">
          {t("back")}
        </Link>
      </div>
    );
  }
  if (!test) return <FullSpinner />;

  async function patch(body: { title?: string; status?: "draft" | "published" }) {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.updateTest(id, body);
      setTest(updated);
      setTitle(updated.title);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeTest() {
    if (!window.confirm(t("confirm_delete_test"))) return;
    setBusy(true);
    try {
      await api.deleteTest(id);
      router.replace("/dashboard");
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  }

  async function saveQuestion(qid: string, body: QuestionInput) {
    const updated = await api.updateQuestion(qid, body);
    setTest((cur) => cur && { ...cur, questions: cur.questions.map((q) => (q.id === qid ? updated : q)) });
  }

  async function removeQuestion(qid: string) {
    await api.removeQuestion(id, qid);
    setTest((cur) => cur && { ...cur, questions: cur.questions.filter((q) => q.id !== qid) });
  }

  const link = `${window.location.origin}/t/${test.share_token}`;
  const titleChanged = title.trim() !== "" && title.trim() !== test.title;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard недоступ аст */
    }
  }

  async function exportWord(answers: boolean) {
    setExporting(answers ? "key" : "student");
    setError(null);
    try {
      const base = test!.title.replace(/[\\/:*?"<>|]+/g, "_");
      await downloadDocx(id, answers, `${base}${answers ? " - answer key" : ""}.docx`);
    } catch (e) {
      setError(errText(e));
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-mute hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("back")}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={test.status} />
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => patch({ status: test.status === "published" ? "draft" : "published" })}
        >
          {test.status === "published" ? t("unpublish") : t("publish")}
        </Button>
        <Link
          href={`/tests/${id}/results`}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold hover:bg-paper"
        >
          <BarChart3 className="h-4 w-4" aria-hidden />
          {t("results_title")}
        </Link>
        <span className="flex-1" />
        <Button size="sm" variant="danger" onClick={removeTest} disabled={busy}>
          <Trash2 className="h-4 w-4" aria-hidden />
          {t("delete_test")}
        </Button>
      </div>

      <div className="rounded-lg border border-line bg-white p-4">
        <label htmlFor="share" className="text-sm font-semibold">
          {t("share_link")}
        </label>
        <div className="mt-1.5 flex gap-2">
          <Input id="share" readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="text-sm" />
          <Button variant="secondary" onClick={copyLink} className="shrink-0">
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? t("copied") : t("copy")}
          </Button>
        </div>
        {test.status !== "published" && <p className="mt-2 text-sm text-mute">{t("link_soon")}</p>}
      </div>

      <div className="rounded-lg border border-line bg-white p-4">
        <p className="text-sm font-semibold">{t("export_title")}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            { key: "student", label: t("export_student"), answers: false },
            { key: "key", label: t("export_key"), answers: true },
          ].map((x) => (
            <div key={x.key} className="space-y-2">
              <p className="text-sm text-mute">{x.label}</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/print/${id}/${x.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold hover:bg-paper"
                >
                  <Printer className="h-4 w-4" aria-hidden />
                  {t("export_print")}
                </a>
                <Button size="sm" variant="secondary" loading={exporting === x.key} onClick={() => exportWord(x.answers)}>
                  <FileDown className="h-4 w-4" aria-hidden />
                  {t("export_word")}
                </Button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-mute">{t("export_pdf_hint")}</p>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <article className="sheet">
        <header className="space-y-3 border-b border-line/70 py-6 pl-14 pr-4 sm:pl-[4.5rem] sm:pr-8">
          <label htmlFor="title" className="sr-only">
            {t("test_title")}
          </label>
          <div className="flex gap-2">
            <Input
              id="title"
              value={title}
              maxLength={255}
              onChange={(e) => setTitle(e.target.value)}
              className="h-12 border-transparent bg-transparent px-0 font-sheet text-2xl font-semibold hover:border-line focus:px-3"
            />
            {titleChanged && (
              <Button onClick={() => patch({ title: title.trim() })} loading={busy} className="shrink-0">
                {t("save")}
              </Button>
            )}
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-mute">
            <span className="rounded bg-pen-soft px-2 py-0.5 font-bold text-pen">{test.level}</span>
            <span>{test.topic}</span>
            <span>{t("questions_count", { n: test.questions.length })}</span>
          </p>
        </header>

        <ol>
          {test.questions.map((q, i) => (
            <QuestionBlock
              key={q.id}
              index={i + 1}
              question={q}
              onSave={(body) => saveQuestion(q.id, body)}
              onRemove={() => removeQuestion(q.id)}
            />
          ))}
        </ol>
      </article>
    </div>
  );
}
