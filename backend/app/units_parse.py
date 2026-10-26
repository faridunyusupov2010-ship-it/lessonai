import re

MAX_LINES = 60


def parse_units(text: str) -> list[tuple[str, list[str]]]:
    """Ҳар сатр: "1A: мавзӯъ, мавзӯъ". Бе ду нуқта ё "|" рақами сатр ҳамчун нишона мешавад."""
    out: list[tuple[str, list[str]]] = []
    auto = 0
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        auto += 1
        label: str | None = None
        rest = line
        for sep in (":", "|", "\t"):
            if sep in line:
                label, _, rest = line.partition(sep)
                break
        if label is None:
            label = str(auto)
        label = label.strip()[:50] or str(auto)
        topics = [t.strip()[:120] for t in re.split(r"[;,]", rest) if t.strip()]
        if not topics:
            continue
        out.append((label, topics[:20]))
        if len(out) >= MAX_LINES:
            break
    return out
