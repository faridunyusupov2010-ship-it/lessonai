# LessonAI — Дастури роҳандозии лоиҳа (Quick Start Guide)

Ин дастур барои зуд ва осон роҳандозӣ (run) кардани муҳити таҳияи лоиҳаи **LessonAI** пешбинӣ шудааст.


## 🚀 Қадамҳои роҳандозӣ

Аввал папкаи **`lessonai`**-ро дар VS Code кушоед (`File` → `Open Folder...` → `lessonai`).

---

### 1️⃣ Қадами 1: Иҷрои Базаи маълумот (PostgreSQL)

Дар **Терминали 1** фармони зеринро иҷро кунед, то базаи маълумот тавассути Docker оғоз шавад:

```bash
docker compose up -d
```

---

### 2️⃣ Қадами 2: Созмон ва иҷрои Backend (FastAPI)

Ҳамон **Терминали 1**-ро истифода баред:

1. Гузариш ба папкаи backend ва сохтани муҳити виртуалӣ (Virtual Environment):
   ```bash
   cd backend
   
   ```


2. Насби китобхонаҳои лозима:
   ```bash
   pip install -r requirements.txt
   ```


3. Иҷрои сервери Backend:
   ```bash
   uvicorn app.main:app --reload
   ```

> 🔍 **Санҷиш:** Дар браузер ба суроғаи [http://localhost:8000/health](http://localhost:8000/health) гузаред. Бояд ҷавоби `{"status":"ok"}` пайдо шавад. 
> 
> ⚠️ **Эзоҳ:** Ин терминалро набандед!

---

### 3️⃣ Қадами 3: Созмон ва иҷрои Frontend (Next.js / React)

Дар VS Code тугмаи **`+`**-ро пахш карда, **Терминали 2**-ро кушоед:

1. Гузариш ба папкаи frontend ва насби бастаҳо (dependencies):
   ```bash
   cd frontend
   npm install
   ```

2. Иҷрои лоиҳаи Frontend:
   ```bash
   npm run dev
   ```

---

## 🎉 Анҷом

Вақте ки дар терминали дуюм навиштаҷоти **`Ready`** пайдо мешавад, браузерро кушоед ва ба суроғаи зерин ворид шавед:

👉 **[http://localhost:3000](http://localhost:3000)**