import json
import logging

import time

from openai import (
    AuthenticationError,
    BadRequestError,
    NotFoundError,
    OpenAI,
    PermissionDeniedError,
    RateLimitError,
)

from .config import Provider, settings
from .verify import kept_indices
from .models import CEFRLevel, QuestionType
from .schemas import QuestionBase

log = logging.getLogger(__name__)

LANGUAGE_NAMES = {"tg": "Tajik", "ru": "Russian", "en": "English"}

SYSTEM_PROMPT = """You are an expert ESL (English as a second language) test writer \
helping independent English teachers.

Return ONLY one valid JSON object, no markdown fences, no commentary:
{"questions": [
  {"type": "multiple_choice" | "fill_blank" | "true_false",
   "topic_tag": "short specific topic, 1-4 words",
   "prompt": "the question text",
   "options": ["..", "..", "..", ".."] or null,
   "correct_answer": <see rules>,
   "explanation": "1-2 sentences why the answer is correct"}
]}

Rules per type:
- multiple_choice: exactly 4 options, exactly one correct. correct_answer is the 0-based \
index (integer). Distractors must be plausible and reflect common learner mistakes. \
Vary the position of the correct option.
- fill_blank: the prompt contains exactly one blank written as _____ . options is null. \
correct_answer is a list of ALL acceptable answers (strings), including common variants \
and contractions. Avoid blanks with several equally valid answers you did not list.
- true_false: the prompt is a single statement. options is null. correct_answer is true or false. \
Mix true and false statements.

General rules:
- Before output, solve EVERY question yourself and check the answer key. The marked answer must be the ONLY correct one; if two options could be correct or none is, rewrite the question. Never mark a wrong form as correct (for example after did/does/do the verb is in base form).
- Questions, options and prompts are always in English and must match the requested CEFR level \
(vocabulary, sentence length, grammar complexity).
- Every question must test the requested topic. No duplicate or near-duplicate questions.
- Use varied, natural, culturally neutral sentences and names.
- If several types are requested, split the questions roughly equally among them.
- Write each explanation in the requested explanation language.
"""

LEVEL_HINTS = {
    CEFRLevel.A1: "beginner: very common words, present simple, basic sentences",
    CEFRLevel.A2: "elementary: everyday topics, simple past, simple future, short sentences",
    CEFRLevel.B1: "intermediate: familiar topics, a range of tenses, simple conditionals",
    CEFRLevel.B2: "upper-intermediate: abstract topics, complex structures, phrasal verbs",
    CEFRLevel.C1: "advanced: nuanced vocabulary, idioms, complex grammar and collocations",
    CEFRLevel.C2: "proficiency: subtle distinctions, rare vocabulary, sophisticated structures",
}


class LLMError(Exception):
    pass


def _extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object in response")
    return json.loads(text[start : end + 1])


def _build_user_prompt(
    topic: str,
    level: CEFRLevel,
    types: list[QuestionType],
    count: int,
    explanation_language: str,
    unit_context: str | None,
) -> str:
    lines = [
        f"Topic: {topic}",
        f"CEFR level: {level.value} ({LEVEL_HINTS[level]})",
        f"Number of questions: {count}",
        f"Question types: {', '.join(t.value for t in types)}",
        f"Explanation language: {explanation_language}",
    ]
    if unit_context:
        lines.append(f"Textbook context (match its scope and vocabulary): {unit_context}")
    return "\n".join(lines)


VERIFY_SYSTEM = """You are a strict English grammar and vocabulary expert solving a test. \
You get questions WITHOUT an answer key. For each question choose the single best answer yourself.
Return ONLY JSON: {"answers": [{"i": 0, "answer": <value>, "ambiguous": false}]}
- multiple_choice: answer is the 0-based index of the correct option.
- true_false: answer is true or false.
- fill_blank: answer is the single best word or phrase (string).
Set "ambiguous": true if more than one option is acceptable or none is correct."""

TRANSLATE_SYSTEM = """You translate short grammar explanations for English learners into {language}. \
Keep English words, example sentences and anything inside quotes exactly as in the original. \
Be natural and concise. If a text is already in {language}, return it unchanged.
Return ONLY JSON: {"items": [{"i": 0, "text": "..."}]}"""

# ----------------------- Провайдерҳо ва гузариш -----------------------

_cooldown_until: dict[str, float] = {}


def _make_client(p: Provider) -> OpenAI:
    # max_retries=0: ҳангоми лимит фавран ба провайдери навбатӣ мегузарем
    return OpenAI(api_key=p.api_key, base_url=p.base_url, timeout=45, max_retries=0)


def _ordered(avoid: str | None = None) -> list[Provider]:
    """Тартиби кӯшиш: аввал провайдерҳои тайёр (бо афзалият), сонӣ онҳое, ки "танаффус" доранд.
    avoid: провайдере, ки охир мегузорем (масалан, барои санҷиши салиб бо модели дигар)."""
    providers = settings.providers()
    if not providers:
        raise LLMError("LLM is not configured (set LLM_API_KEY and LLM_MODEL)")
    now = time.time()
    ready = [p for p in providers if _cooldown_until.get(p.name, 0) <= now]
    cooling = [p for p in providers if p not in ready]
    ordered = ready + cooling
    if avoid:
        ordered = [p for p in ordered if p.name != avoid] + [p for p in ordered if p.name == avoid]
    return ordered * 2 if len(ordered) == 1 else ordered


def _note_failure(p: Provider, e: Exception) -> None:
    seconds = 20.0
    if isinstance(e, RateLimitError):
        seconds = 300.0
        try:
            retry_after = e.response.headers.get("retry-after")
            if retry_after:
                seconds = min(max(float(retry_after), 30.0), 3600.0)
        except Exception:
            pass
    elif isinstance(e, (AuthenticationError, PermissionDeniedError, NotFoundError)):
        seconds = 1800.0  # эҳтимол калид ё номи модел нодуруст аст
    elif isinstance(e, ValueError):
        seconds = 0.0  # ҷавоби нодурусти як маротиба: провайдерро ҷазо намедиҳем
    if seconds:
        _cooldown_until[p.name] = time.time() + seconds
    log.warning(
        "LLM provider %s failed (%s: %s); next provider, cooldown %.0fs",
        p.name,
        type(e).__name__,
        str(e)[:200],
        seconds,
    )


def providers_status() -> list[dict]:
    now = time.time()
    return [
        {
            "name": p.name,
            "model": p.model,
            "cooling_seconds": max(0, int(_cooldown_until.get(p.name, 0) - now)),
        }
        for p in settings.providers()
    ]


def _merge_system(messages: list[dict]) -> list[dict]:
    system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
    rest = [m for m in messages if m["role"] != "system"]
    if system and rest:
        rest = [{"role": rest[0]["role"], "content": f"{system}\n\n{rest[0]['content']}"}] + rest[1:]
    return rest


def _complete(p: Provider, messages: list[dict], max_tokens: int, temperature: float) -> str:
    client = _make_client(p)
    try:
        resp = client.chat.completions.create(
            model=p.model, messages=messages, max_tokens=max_tokens, temperature=temperature
        )
    except BadRequestError as e:
        # Баъзе моделҳо (масалан Gemma) нақши "system"-ро қабул намекунанд
        if not any(w in str(e).lower() for w in ("system", "developer", "instruction")):
            raise
        resp = client.chat.completions.create(
            model=p.model,
            messages=_merge_system(messages),
            max_tokens=max_tokens,
            temperature=temperature,
        )
    return resp.choices[0].message.content or ""


# --------------------------- Корҳои AI ---------------------------


def _verify(questions: list[QuestionBase], generated_by: str) -> list[QuestionBase]:
    """Санҷиши салиб: саволҳоро модели ДИГАР (агар бошад) бе калид ҳал мекунад."""
    payload = []
    for i, q in enumerate(questions):
        item: dict = {"i": i, "type": q.type.value, "prompt": q.prompt}
        if q.options:
            item["options"] = q.options
        payload.append(item)
    messages = [
        {"role": "system", "content": VERIFY_SYSTEM},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]

    answers = None
    try:
        for p in _ordered(avoid=generated_by):
            try:
                text = _complete(p, messages, min(800 + 150 * len(questions), 4000), 0.0)
                answers = _extract_json(text).get("answers")
                if not isinstance(answers, list):
                    raise ValueError("bad answers format")
                log.info("Answers verified by %s (generated by %s)", p.name, generated_by)
                break
            except Exception as e:
                answers = None
                _note_failure(p, e)
    except LLMError:
        pass
    if answers is None:
        log.warning("Answer verification skipped: no provider could verify")
        return questions

    keys = [(q.type.value, q.correct_answer, len(q.options or [])) for q in questions]
    keep = kept_indices(keys, answers)
    if len(keep) < len(questions):
        log.info("Verification dropped %d of %d questions", len(questions) - len(keep), len(questions))
    return [questions[i] for i in keep] or questions


def translate_texts(texts: list[str], lang: str) -> list[str | None]:
    """Тарҷумаи шарҳҳо ба забони lang. Барои матни тарҷиманашуда None бармегардад."""
    language = LANGUAGE_NAMES.get(lang, "English")
    payload = [{"i": i, "text": t} for i, t in enumerate(texts)]
    messages = [
        {"role": "system", "content": TRANSLATE_SYSTEM.replace("{language}", language)},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]
    last: Exception | None = None
    for p in _ordered():
        try:
            text = _complete(p, messages, min(600 + 250 * len(texts), 4000), 0.0)
            items = _extract_json(text).get("items", [])
            by_i = {
                it["i"]: it["text"].strip()
                for it in items
                if isinstance(it, dict) and isinstance(it.get("i"), int) and isinstance(it.get("text"), str)
            }
            return [by_i.get(i) or None for i in range(len(texts))]
        except Exception as e:
            last = e
            _note_failure(p, e)
    raise LLMError(f"Translation failed: {last}")


def generate_questions(
    *,
    topic: str,
    level: CEFRLevel,
    types: list[QuestionType],
    count: int,
    ui_language: str,
    unit_context: str | None = None,
) -> list[QuestionBase]:
    # Якчанд савол бештар месозем, то баъди санҷиш шумораи дархостшуда боқӣ монад
    ask = count + max(1, count // 5)
    user_prompt = _build_user_prompt(
        topic, level, types, ask, LANGUAGE_NAMES.get(ui_language, "English"), unit_context
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    errors: list[str] = []
    for p in _ordered():
        try:
            # Баъзе провайдерҳои ройгон лимити токен дар дақиқа доранд, пас сақф мегузорем
            text = _complete(p, messages, min(1500 + 300 * ask, 6000), 0.5)
            raw_questions = _extract_json(text).get("questions", [])
            valid: list[QuestionBase] = []
            for raw in raw_questions:
                try:
                    q = QuestionBase.model_validate(raw)
                except Exception as e:
                    log.warning("Skipping invalid question: %s", e)
                    continue
                if q.type in types:
                    valid.append(q)
            if not valid:
                raise ValueError("no valid questions returned")
        except Exception as e:  # лимит, шабака, JSON-и нодуруст ва ғ.: провайдери навбатӣ
            _note_failure(p, e)
            errors.append(f"{p.name}: {type(e).__name__}")
            continue
        log.info("Questions generated by %s", p.name)
        return _verify(valid, generated_by=p.name)[:count]

    raise LLMError("Could not generate questions: " + "; ".join(errors))
