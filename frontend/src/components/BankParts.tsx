"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { bankApi, type Level, type QType, type Question, type Test } from "@/lib/api";
import { useI18n, type Key } from "@/lib/i18n";
import { Button, ErrorNote, Input, cn } from "./ui";

const LEVELS: Level[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const TYPES: { id: QType; label: Key }[] = [
  { id: "multiple_choice", label: "type_mc" },
  { id: "fill_blank", label: "type_fb" },
  { id: "true_false", label: "type_tf" },
];
const LETTERS = ["A", "B", "C", "D", "E", "F"];
const selectCls = "h-11 rounded-md border border-line bg-white px-3 text-[15px]";

export function QuestionPreview({ q }: { q: Question }) {
  const { t } = useI18n();
  return (
    <div>
      <p className="font-sheet text-[18px] leading-relaxed">{q.prompt}</p>
      {q.type === "multiple_choice" && q.options && (
        <ol className="mt-2 space-y-1 font-sheet text-[16px]">
          {q.options.map((o, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-5 text-mute">{LETTERS[i]}.</span>
              <span className={cn(q.correct_answer === i && "mark")}>{o}</span>
            </li>
          ))}
        </ol>
      )}
      {q.type === "true_false" && (
        <p className="mt-2 font-sheet text-[16px]">
          <span className="mark">{q.correct_answer === true ? "True" : "False"}</span>
        </p>
      )}
      {q.type === "fill_blank" && Array.isArray(q.correct_answer) && (
        <p className="mt-2 font-sheet text-[16px]">
          <span className="mark">{q.correct_answer.join(" / ")}</span>
        </p>
      )}
      {q.explanation && (
        <p className="mt-2 text-sm text-mute">
          <span className="font-semibold text-ink">{t("explanation")}:</span> {q.explanation}
        </p>
      )}
      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mute">
        <span className="rounded bg-pen-soft px-2 py-0.5 font-bold text-pen">{q.level}</span>
        <span className="rounded bg-paper px-2 py-0.5">{q.topic_tag}</span>
      </p>
    </div>
  );
}

export function useBankList(level: Level | "", type: QType | "", search: string) {
  const { errText } = useI18n();
  const [items, setItems] = useState<Question[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    const h = setTimeout(() => {
      bankApi
        .list({ level: level || undefined, type: type || undefined, q: search })
        .then((x) => alive && setItems(x))
        .catch((e) => alive && setError(errText(e)));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, type, search]);

  return { items, setItems, error };
}

export function BankFilters(props: {
  level: Level | "";
  setLevel: (l: Level | "") => void;
  type: QType | "";
  setType: (t: QType | "") => void;
  search: string;
  setSearch: (s: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-2 sm:grid-cols-[8rem_14rem_1fr]">
      <select aria-label={t("level")} value={props.level} onChange={(e) => props.setLevel(e.target.value as Level | "")} className={selectCls}>
        <option value="">{t("level")}: {t("bank_all")}</option>
        {LEVELS.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <select aria-label={t("types")} value={props.type} onChange={(e) => props.setType(e.target.value as QType | "")} className={selectCls}>
        <option value="">{t("types")}: {t("bank_all")}</option>
        {TYPES.map((x) => (
          <option key={x.id} value={x.id}>
            {t(x.label)}
          </option>
        ))}
      </select>
      <Input
        value={props.search}
        onChange={(e) => props.setSearch(e.target.value)}
        placeholder={t("bank_search")}
        aria-label={t("bank_search")}
      />
    </div>
  );
}

export function BankPicker({ test, onAdded }: { test: Test; onAdded: (t: Test) => void }) {
  const { t, errText } = useI18n();
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<Level | "">("");
  const [type, setType] = useState<QType | "">("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { items, error: loadError } = useBankList(level, type, search);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function add() {
    setBusy(true);
    setError(null);
    try {
      onAdded(await bankApi.addToTest(test.id, picked));
      setPicked([]);
      setOpen(false);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Plus className="h-4 w-4" aria-hidden />
        {t("bank_from")}
      </Button>
      {open && (
        <div className="mt-4 space-y-3">
          <BankFilters level={level} setLevel={setLevel} type={type} setType={setType} search={search} setSearch={setSearch} />
          <p className="text-sm text-mute">{t("bank_pick_hint")}</p>
          {(loadError || error) && <ErrorNote>{loadError || error}</ErrorNote>}
          {items && items.length === 0 && <p className="py-4 text-center text-mute">{t("bank_none_match")}</p>}
          <ul className="max-h-96 divide-y divide-line overflow-y-auto rounded-md border border-line">
            {(items ?? []).map((q) => (
              <li key={q.id}>
                <label className="flex cursor-pointer gap-3 px-3 py-3 hover:bg-pen-soft/40">
                  <input
                    type="checkbox"
                    checked={picked.includes(q.id)}
                    onChange={() => toggle(q.id)}
                    className="mt-1.5 h-4 w-4 shrink-0 accent-[#2243B6]"
                  />
                  <QuestionPreview q={q} />
                </label>
              </li>
            ))}
          </ul>
          <Button onClick={add} loading={busy} disabled={picked.length === 0}>
            {t("bank_add_selected", { n: picked.length })}
          </Button>
        </div>
      )}
    </div>
  );
}
