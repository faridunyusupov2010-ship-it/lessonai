"""Санҷиши мустақили калиди ҷавоб: модел саволро бе калид ҳал мекунад ва натиҷа бо
калиди сохташуда муқоиса мешавад. Саволи ихтилофнок ё номуайян партофта мешавад."""

from .grading import is_correct

LETTERS = "ABCDEF"


def normalize_answer(qtype: str, answer, n_options: int):
    if qtype == "multiple_choice" and isinstance(answer, str):
        a = answer.strip()
        if len(a) == 1 and a.upper() in LETTERS[:n_options]:
            return LETTERS.index(a.upper())
        if a.isdigit():
            return int(a)
    if qtype == "true_false" and isinstance(answer, str):
        a = answer.strip().lower()
        if a in ("true", "false"):
            return a == "true"
    if qtype == "fill_blank" and isinstance(answer, list):
        return answer[0] if answer and isinstance(answer[0], str) else None
    return answer


def kept_indices(keys: list[tuple[str, object, int]], answers: list) -> list[int]:
    """keys[i] = (type, correct_answer, number_of_options). Рӯйхати индексҳои мондаро медиҳад."""
    by_i = {a["i"]: a for a in answers if isinstance(a, dict) and isinstance(a.get("i"), int)}
    kept: list[int] = []
    for i, (qtype, correct, n_options) in enumerate(keys):
        a = by_i.get(i)
        if a is None:
            kept.append(i)  # верификатор ҷавоб надод: касро ҷазо намедиҳем
            continue
        if a.get("ambiguous") is True:
            continue
        if is_correct(qtype, correct, normalize_answer(qtype, a.get("answer"), n_options)):
            kept.append(i)
    return kept
