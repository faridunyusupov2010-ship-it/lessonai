"use client";

import { forwardRef, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TestStatus } from "@/lib/api";

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const variants = {
  primary: "bg-pen text-white hover:bg-pen-dark",
  secondary: "border border-line bg-white text-ink hover:bg-paper",
  ghost: "text-ink hover:bg-ink/5",
  danger: "border border-alert/30 bg-white text-alert hover:bg-alert/5",
} as const;

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: "md" | "sm";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  type = "button",
  ...p
}: BtnProps) {
  return (
    <button
      {...p}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        size === "md" ? "h-11 px-5 text-[15px]" : "h-9 px-3 text-sm",
        variants[variant],
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...p }, ref) {
    return (
      <input
        ref={ref}
        {...p}
        className={cn(
          "h-11 w-full rounded-md border border-line bg-white px-3 text-[15px] placeholder:text-mute/70 focus:border-pen",
          className,
        )}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...p }, ref) {
  return (
    <textarea
      ref={ref}
      {...p}
      className={cn(
        "w-full rounded-md border border-line bg-white px-3 py-2 text-[15px] placeholder:text-mute/70 focus:border-pen",
        className,
      )}
    />
  );
});

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-sm text-mute">{hint}</p>}
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-md border border-alert/30 bg-alert/5 px-3 py-2 text-sm text-alert">
      {children}
    </p>
  );
}

export function FullSpinner() {
  const { t } = useI18n();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const h = setTimeout(() => setSlow(true), 2500);
    return () => clearTimeout(h);
  }, []);
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-2xl font-extrabold tracking-tight">
          Lesson<span className="mark">AI</span>
        </p>
        <Loader2 className="h-6 w-6 animate-spin text-pen" aria-hidden />
        <p
          aria-live="polite"
          className={cn("max-w-xs text-sm text-mute transition-opacity duration-500", slow ? "opacity-100" : "opacity-0")}
        >
          {t("waking_up")}
        </p>
      </div>
    </div>
  );
}

const statusStyle: Record<TestStatus, string> = {
  draft: "bg-ink/5 text-mute",
  published: "bg-ok/10 text-ok",
  archived: "bg-ink/5 text-mute",
};

export function StatusBadge({ status }: { status: TestStatus }) {
  const { t } = useI18n();
  const label =
    status === "draft"
      ? t("status_draft")
      : status === "published"
        ? t("status_published")
        : t("status_archived");
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", statusStyle[status])}>
      {label}
    </span>
  );
}
