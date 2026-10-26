TAJIK_ONLY = set("ғӣқӯҳҷҒӢҚӮҲҶ")


def guess_lang(text: str) -> str:
    """Тахмини оддии забон: tg (ҳарфҳои хоси тоҷикӣ), ru (кириллик) ё en."""
    if any(ch in TAJIK_ONLY for ch in text):
        return "tg"
    if any("\u0400" <= ch <= "\u04ff" for ch in text):
        return "ru"
    return "en"
