# Ҷойгиркунӣ дар интернет (ройгон)

Се хидмат: **Neon** (база), **Render** (backend), **Vercel** (frontend). Ҳамаи се нақшаи ройгон доранд.
Тартиби кор муҳим аст: аввал база, баъд backend, баъд frontend.

## 1. GitHub (як маротиба)

1. Дар https://github.com ҳисоб созед.
2. Дар VS Code: тугмаи **Source Control** (чап, шохаи git) → **Initialize Repository**.
3. Дар майдони «Message» нависед `first version` → **Commit** (агар пурсанд «Stage all?» → Yes).
4. **Publish Branch** → интихоби **Private repository** → OK. VS Code аз шумо воридшавӣ ба GitHub-ро мепурсад.

Санҷед: дар GitHub файлҳои `.env` ва `node_modules` набояд бошанд (`.gitignore` онҳоро пинҳон мекунад).

## 2. База: Neon

1. https://neon.tech → ҳисоб созед → **Create project** (ном: `lessonai`, ҷой: ба Аврупо наздиктарин, масалан Frankfurt).
2. Дар саҳифаи loyiha тугмаи **Connect** → нусха кунед **Connection string**. Он чунин аст:
   `postgresql://user:password@ep-xxxx.neon.tech/neondb?sslmode=require`
3. Онро ҷудо захира кунед (ба Render лозим мешавад). Ба касе нафиристед.

## 3. Backend: Render

1. https://render.com → ҳисоб созед (бо GitHub).
2. **New +** → **Blueprint** → репозиторияи `lessonai`-ро интихоб кунед. Render `render.yaml`-ро худаш мехонад.
3. Аз шумо се қиматро мепурсад:
   - `DATABASE_URL`: сатри Neon аз қадами 2
   - `LLM_API_KEY`: калиди Groq
   - `CORS_ORIGINS`: ҳоло ин гузоред: `["http://localhost:3000"]` (баъд иваз мекунем)
4. **Apply** → 3–5 дақиқа интизор шавед. Баъд URL-и backend пайдо мешавад, масалан `https://lessonai-api.onrender.com`.
5. Санҷед: `https://<URL-и-шумо>/health` бояд `{"status":"ok"}` диҳад.

## 4. Frontend: Vercel

1. https://vercel.com → ҳисоб созед (бо GitHub).
2. **Add New → Project** → репозиторияи `lessonai`-ро Import кунед.
3. **Root Directory** → **Edit** → интихоб кунед `frontend`.
4. **Environment Variables**: номи `NEXT_PUBLIC_API_URL`, қимат: URL-и Render (бе `/` дар охир).
5. **Deploy**. Баъд URL-и сайт пайдо мешавад, масалан `https://lessonai-xxx.vercel.app`.

## 5. CORS-ро ислоҳ кунед (муҳим!)

Дар Render: хидмати `lessonai-api` → **Environment** → `CORS_ORIGINS`-ро иваз кунед бо URL-и Vercel:

```
["https://lessonai-xxx.vercel.app"]
```

Save → хидмат худаш аз нав оғоз мешавад. Бе ин қадам сайт ба backend мурояҷиат карда наметавонад.

## 6. Санҷиш

1. Сайти Vercel-ро кушоед → сабти ном → тест созед → нашр кунед.
2. Истиноди хонандаро дар телефон кушоед: ҳоло кор мекунад!

## Чизҳое, ки бояд донед

- **Хобрафтани backend:** дар нақшаи ройгон Render пас аз 15 дақиқа бекорӣ хоб меравад. Дархости аввал баъд аз он 30–60 сония давом мекунад. Ба омӯзгорон пешакӣ бигӯед.
- **Лимити AI:** Groq дар рӯз тақрибан 40–60 тест иҷозат медиҳад. Вақте пур шавад, хато нишон дода мешавад. Баъдтар ба модели пулакии арзон мегузарем.
- **Истифодаи тиҷоратӣ:** нақшаи ройгони Vercel (Hobby) барои лоиҳаҳои ғайритиҷоратӣ аст. То вақте ки аз омӯзгорон пул намегиред, мушкил нест. Пеш аз пул гирифтан шартҳои ҷории онро санҷед ё ба хидмати дигар гузаред.
- **Тағйири база:** ҳоло ҷадвалҳо дар оғози сервер худкор сохта мешаванд. Агар баъдтар сохтори база тағйир ёбад, Alembic (migration) лозим мешавад. Инро пеш аз корбарони воқеӣ ҳал мекунем.
- **Нусхаи эҳтиётӣ:** Neon нақшаи ройгон нусхабардории маҳдуд дорад. Маълумоти муҳимро баъдтар аз нав дида мебароем.
