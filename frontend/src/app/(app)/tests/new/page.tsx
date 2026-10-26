"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, bankApi, booksApi, type Book, type Level, type QType } from "@/lib/api";
import { useI18n, type Key } from "@/lib/i18n";
import { Button, ErrorNote, Field, Input, cn } from "@/components/ui";

const LEVELS: Level[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const TYPES: { id: QType; label: Key }[] = [
  { id: "multiple_choice", label: "type_mc" },
  { id: "fill_blank", label: "type_fb" },
  { id: "true_false", label: "type_tf" },
];

function SkeletonSheet({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="space-y-4" role="status">
      <div className="sheet px-5 py-8 pl-14 sm:pl-[4.5rem]" aria-hidden>
        {[70, 90, 55, 80, 65].map((w, i) => (
          <div key={i} className="mb-6 last:mb-0 space-y-2">
            <div className="h-4 animate-pulse rounded bg-ink/10" style={{ width: `${w}%` }} />
            <div className="h-3 w-1/3 animate-pulse rounded bg-marker/60" />
          </div>
        ))}
      </div>
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-mute">{hint}</p>
    </div>
  );
}

export default function NewTestPage() {
  const { t, errText } = useI18n();
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<Level>("B1");
  const [types, setTypes] = useState<QType[]>(["multiple_choice"]);
  const [count, setCount] = useState(10);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [bookName, setBookName] = useState("");
  const [unitId, setUnitId] = useState(0);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const tp = p.get("topic");
    if (tp) setTopic(tp);
    booksApi
      .list()
      .then(setBooks)
      .catch(() => {});
  }, []);

  const units = books.find((b) => b.book === bookName)?.units ?? [];

  function pickUnit(id: number) {
    setUnitId(id);
    const u = units.find((x) => x.id === id);
    if (u) setTopic(u.topics.join(", "));
  }

  async function createEmpty() {
    setError(null);
    setLoading(true);
    try {
      const test = await bankApi.createTest({
        title: title.trim() || topic.trim() || t("new_test"),
        topic: topic.trim() || t("new_test"),
        level,
      });
      router.push(`/tests/${test.id}`);
    } catch (err) {
      setError(errText(err));
      setLoading(false);
    }
  }

  const toggle = (id: QType) =>
    setTypes((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!types.length) {
      setError(t("pick_type"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const test = await api.generateTest({
        topic: topic.trim(),
        level,
        types,
        count,
        title: title.trim() || undefined,
        book_unit_id: unitId || undefined,
      });
      router.push(`/tests/${test.id}`);
    } catch (err) {
      setError(errText(err));
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{t("gen_title")}</h1>
        <p className="mt-2 max-w-lg text-mute">{t("gen_sub")}</p>
      </div>

      {loading ? (
        <SkeletonSheet title={t("generating")} hint={t("generating_hint")} />
      ) : (
        <form onSubmit={submit} className="space-y-6">
          <div className="space-y-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("gen_book")} htmlFor="book">
                <select
                  id="book"
                  value={bookName}
                  onChange={(e) => {
                    setBookName(e.target.value);
                    setUnitId(0);
                  }}
                  className="h-11 w-full rounded-md border border-line bg-white px-3 text-[15px]"
                >
                  <option value="">{t("gen_none")}</option>
                  {books.map((b) => (
                    <option key={b.book} value={b.book}>
                      {b.book}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("gen_unit")} htmlFor="unit">
                <select
                  id="unit"
                  value={unitId}
                  disabled={!bookName}
                  onChange={(e) => pickUnit(Number(e.target.value))}
                  className="h-11 w-full rounded-md border border-line bg-white px-3 text-[15px] disabled:opacity-60"
                >
                  <option value={0}>-</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}: {u.topics.join(", ")}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {books.length === 0 && (
              <p className="text-sm text-mute">
                {t("gen_book_hint")}{" "}
                <Link href="/books" className="font-semibold text-pen hover:underline">
                  {t("nav_books")}
                </Link>
              </p>
            )}
          </div>

          <Field label={t("topic")} htmlFor="topic">
            <Input
              id="topic"
              required
              maxLength={200}
              placeholder={t("topic_ph")}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </Field>

          <div className="space-y-1.5">
            <span id="level-label" className="block text-sm font-semibold">
              {t("level")}
            </span>
            <div role="radiogroup" aria-labelledby="level-label" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={level === l}
                  onClick={() => setLevel(l)}
                  className={cn(
                    "rounded-md border px-2 py-2 text-center transition-colors",
                    level === l ? "border-pen bg-pen-soft" : "border-line bg-white hover:bg-paper",
                  )}
                >
                  <span className="block text-lg font-bold">{l}</span>
                  <span className="block text-[11px] leading-tight text-mute">{t(`lvl_${l}` as Key)}</span>
                </button>
              ))}
            </div>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-semibold">{t("types")}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {TYPES.map(({ id, label }) => {
                const on = types.includes(id);
                return (
                  <label
                    key={id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-3 text-sm font-semibold",
                      on ? "border-pen bg-pen-soft" : "border-line bg-white hover:bg-paper",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(id)}
                      className="h-4 w-4 accent-[#2243B6]"
                    />
                    {t(label)}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Field label={t("count")} htmlFor="count">
            <div className="flex items-center gap-4">
              <input
                id="count"
                type="range"
                min={5}
                max={20}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="h-2 flex-1 accent-[#2243B6]"
              />
              <span className="w-8 text-right text-lg font-bold">{count}</span>
            </div>
          </Field>

          <Field label={t("title_opt")} htmlFor="title">
            <Input id="title" maxLength={255} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>

          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" className="w-full sm:w-auto">
              {t("generate_btn")}
            </Button>
            <Button variant="ghost" onClick={createEmpty} className="w-full sm:w-auto">
              {t("empty_from_bank")}
            </Button>
          </div>
        </form>
      )}

      {loading && error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}
