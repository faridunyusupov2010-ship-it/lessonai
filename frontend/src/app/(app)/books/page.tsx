"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { booksApi, type Book } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Button, ErrorNote, Field, Input, Textarea } from "@/components/ui";

const SUGGESTIONS = [
  "English File Beginner",
  "English File Elementary",
  "English File Pre-Intermediate",
  "English File Intermediate",
  "English File Upper-Intermediate",
  "English File Advanced",
];

export default function BooksPage() {
  const { t, errText } = useI18n();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    booksApi
      .list()
      .then(setBooks)
      .catch((e) => setError(errText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setBooks(await booksApi.bulk(name.trim(), text));
      setText("");
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeBook(book: string) {
    if (!window.confirm(t("books_confirm_delete"))) return;
    try {
      await booksApi.deleteBook(book);
      setBooks((cur) => cur && cur.filter((b) => b.book !== book));
    } catch (err) {
      setError(errText(err));
    }
  }

  async function removeUnit(book: string, id: number) {
    try {
      await booksApi.deleteUnit(id);
      setBooks((cur) =>
        cur && cur.map((b) => (b.book === book ? { ...b, units: b.units.filter((u) => u.id !== id) } : b)).filter((b) => b.units.length > 0),
      );
    } catch (err) {
      setError(errText(err));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{t("books_title")}</h1>
        <p className="mt-2 max-w-xl text-mute">{t("books_sub")}</p>
      </div>

      <form onSubmit={save} className="space-y-4 rounded-lg border border-line bg-white p-5">
        <Field label={t("books_name")} htmlFor="book">
          <Input id="book" required list="book-suggestions" maxLength={255} placeholder={t("books_name_ph")} value={name} onChange={(e) => setName(e.target.value)} />
          <datalist id="book-suggestions">
            {SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label={t("books_units")} htmlFor="units" hint={t("books_units_hint")}>
          <Textarea id="units" required rows={6} placeholder={t("books_units_ph")} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" loading={busy}>
          {t("books_save")}
        </Button>
      </form>

      {books && books.length === 0 && <p className="text-mute">{t("books_empty")}</p>}

      {books?.map((b) => (
        <section key={b.book} className="overflow-hidden rounded-lg border border-line bg-white">
          <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
            <h2 className="flex-1 truncate text-lg font-bold">{b.book}</h2>
            <Button size="sm" variant="danger" onClick={() => removeBook(b.book)}>
              <Trash2 className="h-4 w-4" aria-hidden />
              {t("books_delete")}
            </Button>
          </header>
          <ul className="divide-y divide-line">
            {b.units.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                <span className="w-14 shrink-0 rounded bg-pen-soft px-2 py-0.5 text-center text-sm font-bold text-pen">{u.label}</span>
                <span className="min-w-0 flex-1 text-sm">{u.topics.join(", ")}</span>
                <button
                  type="button"
                  onClick={() => removeUnit(b.book, u.id)}
                  aria-label={t("books_delete_unit")}
                  title={t("books_delete_unit")}
                  className="grid h-8 w-8 place-items-center rounded-md text-mute hover:bg-ink/5 hover:text-alert"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
