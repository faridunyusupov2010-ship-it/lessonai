import json
import logging

from openai import OpenAI

from .config import settings
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


def generate_questions(
    *,
    topic: str,
    level: CEFRLevel,
    types: list[QuestionType],
    count: int,
    ui_language: str,
    unit_context: str | None = None,
) -> list[QuestionBase]:
    if not settings.llm_api_key or not settings.llm_model:
        raise LLMError("LLM is not configured (set LLM_API_KEY and LLM_MODEL)")

    client = OpenAI(
        api_key=settings.llm_api_key, base_url=settings.llm_base_url, timeout=60
    )
    user_prompt = _build_user_prompt(
        topic,
        level,
        types,
        count,
        LANGUAGE_NAMES.get(ui_language, "English"),
        unit_context,
    )

    last_error: Exception | None = None
    for attempt in range(2):
        try:
            resp = client.chat.completions.create(
                model=settings.llm_model,
                # Баъзе моделҳои ройгон лимити токен дар дақиқа доранд, пас сақф мегузорем
                max_tokens=min(1500 + 300 * count, 6000),
                temperature=0.7,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            )
            text = resp.choices[0].message.content or ""
            raw_questions = _extract_json(text).get("questions", [])
        except Exception as e:  # network, API or JSON errors
            last_error = e
            log.warning("LLM attempt %d failed: %s", attempt + 1, e)
            continue

        valid: list[QuestionBase] = []
        for raw in raw_questions:
            try:
                q = QuestionBase.model_validate(raw)
            except Exception as e:
                log.warning("Skipping invalid question: %s", e)
                continue
            if q.type in types:
                valid.append(q)
        if valid:
            return valid[:count]
        last_error = last_error or ValueError("no valid questions returned")

    raise LLMError(f"Could not generate questions: {last_error}")
