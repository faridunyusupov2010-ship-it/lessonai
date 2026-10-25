"""Санҷиши худкори ҷавобҳо. Ҷавоби дуруст ҳеҷ гоҳ ба браузери хонанда намеравад."""

import re


def _norm(s: str) -> str:
    s = s.replace("\u2019", "'").replace("\u2018", "'").replace("`", "'")
    s = re.sub(r"\s+", " ", s.strip().lower())
    return s.rstrip(".!?;, ")


def is_correct(qtype: str, correct, response) -> bool:
    if response is None:
        return False
    if qtype == "multiple_choice":
        return type(response) is int and response == correct
    if qtype == "true_false":
        return type(response) is bool and response == correct
    if qtype == "fill_blank":
        return isinstance(response, str) and _norm(response) in {_norm(a) for a in correct}
    return False
