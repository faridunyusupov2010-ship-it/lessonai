const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "lessonai_token";

export type UILang = "tg" | "ru" | "en";
export type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type QType = "multiple_choice" | "fill_blank" | "true_false";
export type TestStatus = "draft" | "published" | "archived";

export interface Teacher {
  id: string;
  email: string;
  full_name: string;
  ui_language: UILang;
  plan: "free" | "pro";
  is_admin?: boolean;
}

export interface Question {
  id: string;
  type: QType;
  level: Level;
  topic_tag: string;
  prompt: string;
  options: string[] | null;
  correct_answer: number | boolean | string[];
  explanation: string | null;
  in_bank: boolean;
}

export type QuestionInput = Omit<Question, "id" | "level" | "in_bank">;

export interface TestSummary {
  id: string;
  title: string;
  topic: string;
  level: Level;
  status: TestStatus;
  share_token: string;
  created_at: string;
  question_count: number;
}

export interface Test {
  id: string;
  title: string;
  topic: string;
  level: Level;
  status: TestStatus;
  share_token: string;
  time_limit_minutes: number | null;
  created_at: string;
  questions: Question[];
}

export interface GenerateBody {
  topic: string;
  level: Level;
  types: QType[];
  count: number;
  title?: string;
  book_unit_id?: number;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage недоступ аст */
  }
}

function parseDetail(data: unknown): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => (d as { msg?: string }).msg ?? "").filter(Boolean).join("; ");
  }
  return "";
}

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network");
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, parseDetail(data));
  return data as T;
}

interface TokenResponse {
  access_token: string;
  teacher: Teacher;
}

export const api = {
  register: (b: { email: string; password: string; full_name: string; ui_language: UILang }) =>
    request<TokenResponse>("/auth/register", "POST", b),
  login: (email: string, password: string) =>
    request<TokenResponse>("/auth/login", "POST", { email, password }),
  me: () => request<Teacher>("/auth/me"),
  updateMe: (b: { ui_language: UILang }) => request<Teacher>("/auth/me", "PATCH", b),

  listTests: () => request<TestSummary[]>("/tests"),
  generateTest: (b: GenerateBody) => request<Test>("/tests/generate", "POST", b),
  getTest: (id: string, lang?: string) => request<Test>(`/tests/${id}${lang ? `?lang=${lang}` : ""}`),
  updateTest: (id: string, b: { title?: string; status?: TestStatus }) =>
    request<Test>(`/tests/${id}`, "PATCH", b),
  deleteTest: (id: string) => request<void>(`/tests/${id}`, "DELETE"),
  updateQuestion: (id: string, b: QuestionInput) =>
    request<Question>(`/questions/${id}`, "PUT", b),
  removeQuestion: (testId: string, questionId: string) =>
    request<void>(`/tests/${testId}/questions/${questionId}`, "DELETE"),
};

export async function downloadDocx(id: string, answers: boolean, filename: string): Promise<void> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE}/tests/${id}/export.docx?answers=${answers}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError(0, "network");
  }
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    throw new ApiError(res.status, parseDetail(data));
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ------------------------ Student / Results ------------------------

export type ResponseValue = number | boolean | string | null;

export interface PublicQuestion {
  id: string;
  type: QType;
  prompt: string;
  options: string[] | null;
}

export interface PublicTest {
  title: string;
  topic: string;
  level: Level;
  time_limit_minutes: number | null;
  questions: PublicQuestion[];
}

export interface QuestionResult {
  question_id: string;
  type: QType;
  prompt: string;
  options: string[] | null;
  response: ResponseValue;
  is_correct: boolean;
  correct_answer: number | boolean | string[];
  explanation: string | null;
  points_awarded: number;
  points: number;
}

export interface SubmitOut {
  attempt_id: string;
  score: number;
  max_score: number;
  results: QuestionResult[];
}

export interface AttemptSummary {
  id: string;
  student_name: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
}

export interface QuestionStat {
  question_id: string;
  position: number;
  prompt: string;
  topic_tag: string;
  correct: number;
  total: number;
}

export interface TestResults {
  title: string;
  attempts: AttemptSummary[];
  questions: QuestionStat[];
  average_percent: number | null;
}

export interface AttemptDetail extends AttemptSummary {
  results: QuestionResult[];
}

export const studentApi = {
  getTest: (token: string) => request<PublicTest>(`/public/tests/${token}`),
  submit: (
    token: string,
    body: {
      student_name: string;
      answers: { question_id: string; response: number | boolean | string }[];
      lang?: string;
    },
  ) => request<SubmitOut>(`/public/tests/${token}/submit`, "POST", body),
};

export const resultsApi = {
  forTest: (id: string) => request<TestResults>(`/tests/${id}/results`),
  attempt: (id: string, lang?: string) => request<AttemptDetail>(`/attempts/${id}${lang ? `?lang=${lang}` : ""}`),
};

// ----------------------- Bank / Books / Reports -----------------------

export interface BookUnit {
  id: number;
  label: string;
  topics: string[];
}

export interface Book {
  book: string;
  units: BookUnit[];
}

export interface StudentSummary {
  name: string;
  attempts: number;
  percent: number | null;
  last_at: string | null;
}

export interface TopicStat {
  topic: string;
  correct: number;
  total: number;
  percent: number;
}

export const bankApi = {
  list: (p: { level?: Level; type?: QType; q?: string }) => {
    const sp = new URLSearchParams();
    if (p.level) sp.set("level", p.level);
    if (p.type) sp.set("type", p.type);
    if (p.q?.trim()) sp.set("q", p.q.trim());
    const qs = sp.toString();
    return request<Question[]>(`/bank${qs ? `?${qs}` : ""}`);
  },
  setBank: (id: string, in_bank: boolean) =>
    request<Question>(`/questions/${id}/bank`, "PATCH", { in_bank }),
  createTest: (b: { title: string; topic: string; level: Level }) =>
    request<Test>("/tests", "POST", b),
  addToTest: (testId: string, ids: string[]) =>
    request<Test>(`/tests/${testId}/questions`, "POST", { question_ids: ids }),
};

export const booksApi = {
  list: () => request<Book[]>("/books"),
  bulk: (book: string, text: string) => request<Book[]>("/books/units/bulk", "POST", { book, text }),
  deleteUnit: (id: number) => request<void>(`/books/units/${id}`, "DELETE"),
  deleteBook: (book: string) => request<void>(`/books?book=${encodeURIComponent(book)}`, "DELETE"),
};

export const reportsApi = {
  students: () => request<StudentSummary[]>("/reports/students"),
  topics: (student?: string) =>
    request<TopicStat[]>(`/reports/topics${student ? `?student=${encodeURIComponent(student)}` : ""}`),
};

// ------------------------------ Admin ------------------------------

export type Plan = "free" | "pro";

export interface AdminStats {
  teachers: number;
  pro_teachers: number;
  new_teachers_7d: number;
  tests: number;
  tests_today: number;
  attempts: number;
}

export interface AdminTeacher {
  id: string;
  email: string;
  full_name: string;
  plan: Plan;
  created_at: string;
  tests: number;
  attempts: number;
  last_test_at: string | null;
}

export interface LLMProvider {
  name: string;
  model: string;
  cooling_seconds: number;
}

export const adminApi = {
  llm: () => request<LLMProvider[]>("/admin/llm"),
  stats: () => request<AdminStats>("/admin/stats"),
  teachers: () => request<AdminTeacher[]>("/admin/teachers"),
  setPlan: (id: string, plan: Plan) =>
    request<{ id: string; plan: Plan }>(`/admin/teachers/${id}`, "PATCH", { plan }),
};
