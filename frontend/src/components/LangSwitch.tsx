"use client";

import { useAuth } from "@/lib/auth";
import { useI18n, type Lang } from "@/lib/i18n";

export function LangSwitch() {
  const { lang } = useI18n();
  const { changeLanguage } = useAuth();
  return (
    <select
      aria-label="Language"
      value={lang}
      onChange={(e) => changeLanguage(e.target.value as Lang)}
      className="h-9 rounded-md border border-line bg-white px-2 text-sm"
    >
      <option value="tg">Тоҷикӣ</option>
      <option value="ru">Русский</option>
      <option value="en">English</option>
    </select>
  );
}
