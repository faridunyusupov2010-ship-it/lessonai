import logging

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from . import llm
from .langguess import guess_lang
from .models import ExplanationTranslation, Question

log = logging.getLogger(__name__)


def localize_explanations(db: Session, questions: list[Question], lang: str | None) -> dict:
    """{question_id: шарҳ ба забони lang}. Тарҷумаҳо дар база захира мешаванд, пас ҳар савол
    барои ҳар забон як маротиба тарҷума мешавад. Хатогӣ бошад, шарҳи аслӣ нигоҳ дошта мешавад."""
    if lang not in ("tg", "ru", "en"):
        return {}
    todo = [q for q in questions if q.explanation and guess_lang(q.explanation) != lang]
    if not todo:
        return {}

    cached = db.execute(
        select(ExplanationTranslation.question_id, ExplanationTranslation.text).where(
            ExplanationTranslation.lang == lang,
            ExplanationTranslation.question_id.in_([q.id for q in todo]),
        )
    ).all()
    result = {qid: text for qid, text in cached}

    missing = [q for q in todo if q.id not in result]
    if missing:
        try:
            texts = llm.translate_texts([q.explanation for q in missing], lang)
        except Exception as e:
            log.warning("Explanation translation failed: %s", e)
            return result
        rows = []
        for q, text in zip(missing, texts):
            if text:
                result[q.id] = text
                rows.append({"question_id": q.id, "lang": lang, "text": text})
        if rows:
            db.execute(pg_insert(ExplanationTranslation).values(rows).on_conflict_do_nothing())
            db.commit()
    return result
