"use client";

import { useState } from "react";
import { Library } from "lucide-react";
import { bankApi, type Level, type QType } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { BankFilters, QuestionPreview, useBankList } from "@/components/BankParts";
import { Button, ErrorNote } from "@/components/ui";

export default function BankPage() {
  const { t, errText } = useI18n();
  const [level, setLevel] = useState<Level | "">("");
  const [type, setType] = useState<QType | "">("");
  const [search, setSearch] = useState("");
  const { items, setItems, error: loadError } = useBankList(level, type, search);
  const [error, setError] = useState<string | null>(null);
  const filtered = level !== "" || type !== "" || search.trim() !== "";

  async function remove(id: string) {
    try {
      await bankApi.setBank(id, false);
      setItems((cur) => cur && cur.filter((q) => q.id !== id));
    } catch (e) {
      setError(errText(e));
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight">{t("bank_title")}</h1>
      <BankFilters level={level} setLevel={setLevel} type={type} setType={setType} search={search} setSearch={setSearch} />
      {(loadError || error) && <ErrorNote>{loadError || error}</ErrorNote>}

      {items && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-line bg-white px-6 py-14 text-center">
          <Library className="mx-auto h-8 w-8 text-mute" aria-hidden />
          <p className="mx-auto mt-4 max-w-sm text-mute">{filtered ? t("bank_none_match") : t("bank_empty")}</p>
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
          {items.map((q) => (
            <li key={q.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:px-5">
              <div className="min-w-0 flex-1">
                <QuestionPreview q={q} />
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(q.id)} className="shrink-0 self-start">
                {t("bank_remove")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
