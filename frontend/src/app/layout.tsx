import type { Metadata } from "next";
import { Manrope, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";

const ui = Manrope({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-ui",
  display: "swap",
});
const sheet = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-sheet",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LessonAI",
  description: "AI assistant for English teachers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tg" className={`${ui.variable} ${sheet.variable}`}>
      <body>
        <I18nProvider>
          <AuthProvider>{children}</AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
