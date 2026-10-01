# AGENTS.md

## Специальные указания для Cursor Cloud

### Обзор проекта

Eiti Wizard — это статическая Progressive Web App без зависимостей и без сборки (zero-dependency, zero-build): чистые HTML/CSS/JS, без фреймворков, без бандлера, без `package.json` приложения. Замерено на HEAD `2bad54791b715636043da6725b1685774db1829b`: `index.html` — 891819 байт (~871 КиБ), 12929 строк. Это AI-рабочее пространство, целиком работающее в браузере: чат, агенты, файлы, локальная память через IndexedDB. Подробный список возможностей и план развития — в `README.md`.

Подсистема эталонной памяти (reference-memory, пространство `wiz_ref_*`) живёт не только в `index.html`: код — в `wiz-ref-memory.js` (подключается из `index.html` сразу после `sql-wasm.js`), данные — в той же SQLite-базе (`window._wizDB`), рантайм SQLite — в `sql-wasm.js` + `sql-wasm.wasm`. Спецификация — в `docs/REFERENCE_MEMORY.md`. Всё это по-прежнему статика без сборки.

### Запуск dev-сервера

Корень репозитория отдавать любым статическим HTTP-сервером. Для Service Worker нужен HTTP (не `file://`).

```bash
python3 -m http.server 8080 # предпочтительно — ничего ставить не нужно
# или: npx serve -l 8080 .
```

Затем открыть `http://localhost:8080/index.html` в Chrome.

### Сборка / Линт / Тесты

Сборки нет, линтера нет, конвейера непрерывной интеграции нет, файла `package.json` приложения нет. Но тестовый набор есть: каталог `tests/refmem/` (набор для reference-memory). Первичная инструкция — `tests/refmem/README.md`.

Команды из корня репозитория:

```bash
# 1) Набор уровня базы данных — настоящий wiz-ref-memory.js + блок памяти из index.html + репозиторные sql-wasm
node tests/refmem/db.test.cjs

# 2) Браузерный набор — настоящая страница, настоящий IndexedDB, настоящий интерфейс.
# Тестовая зависимость puppeteer-core ставится ВНЕ репозитория, например:
# npm i --prefix /tmp/pup puppeteer-core@23.11.1
git archive origin/main | (mkdir -p /tmp/refmem-main && tar -x -C /tmp/refmem-main)
PUPPETEER_CORE=/tmp/pup/node_modules/puppeteer-core CHROME_PATH=/usr/bin/google-chrome \
  REFMEM_PORT=18791 MAIN_ROOT=/tmp/refmem-main node tests/refmem/browser.test.mjs

# 3) Проверка границы приватности — файлы шаблонов только локальные, никогда не коммитятся
PRIVATE_IDS=/local/private-ids.txt PRIVATE_TITLES=/local/private-titles.txt BASE=origin/main \
  bash tests/refmem/scan-private.sh
```

Состав `tests/refmem/`: `db.test.cjs`, `browser.test.mjs`, `scan-private.sh`, `README.md`, `fixtures/` (синтетические фикстуры `synthetic.v1.fixture.jsonl`, `synthetic.v2.fixture.jsonl`, `invalid.fixture.jsonl`).

Известное условие тестового стенда (не регрессия рантайма): проверка P2-1 в `db.test.cjs` сравнивает `CACHE_NAME` в `sw.js` рабочего дерева с `CACHE_NAME` в `sw.js` на `origin/main` и требует различия. Когда дерево под тестом и есть `main`, сравниваемый сам с собой, проверка падает с сообщением вида `CACHE_NAME not bumped`. Это ожидаемое поведение стенда на совпадающем дереве, а не поломка Service Worker.

### Тестовые зависимости

Само приложение остаётся без зависимостей и без сборки. Зависимости только для тестов (например, `puppeteer-core` для браузерного набора) ставятся временно вне репозитория (например, в `/tmp/pup`) и не должны становиться зависимостями рантайма приложения. В репозиторий нельзя добавлять `package.json`, `node_modules` или вендоренные тестовые библиотеки.

### Заметки о провайдерах ИИ

Проверено на текущем HEAD чтением кода (`index.html`). Три разных уровня, не смешивать:

1. Присутствует в интерфейсе и коде (селекторы `cfgProvider` и `cfgAgentProvider`, ветки отправки чата, проверка ключей): Ollama (офлайн, `http://localhost:11434/api/chat`, проверка через `/api/tags`), DeepSeek (`https://api.deepseek.com/v1/chat/completions`), Claude/Anthropic (`https://api.anthropic.com/v1/messages`), OpenAI (`https://api.openai.com/v1/chat/completions`), Groq (`https://api.groq.com/openai/v1/chat/completions`), OpenRouter (`https://openrouter.ai/api/v1/chat/completions`), Gemini (`https://generativelanguage.googleapis.com/v1beta/models/...:generateContent?key=...`), Grok (`https://api.x.ai/v1/chat/completions`). Чат Grok идёт через `https://api.x.ai/v1/chat/completions`. Отдельно существует голосовой канал Grok Voice через `wss://api.x.ai/v1/realtime` — это не чатовый endpoint.
2. Живая сквозная проверка (E2E): в репозитории нет свидетельств живого сквозного прогона чата ни по одному провайдеру. Набор `tests/refmem/` покрывает только reference-memory (уровень базы, браузерный интерфейс памяти, сканирование приватности). Поэтому про живой E2E ничего не утверждается.
3. Нативная поддержка инструментов агента (tool-use): только DeepSeek и Gemini. Подтверждено функцией `_agentToolUseSupported()` в `index.html` (`provider === 'deepseek' || provider === 'gemini'`) и подписью переключателя `cfgAgentToolUse` («Нативные function calls (DeepSeek / Gemini)»). У Grok, OpenAI, Claude, Groq, OpenRouter и Ollama нативного tool-use в агентском цикле нет.

Приложение по умолчанию использует Ollama (`localhost:11434`) для офлайнового ИИ. Без запущенного Ollama отправка сообщения чата даст ошибку вида «Failed to fetch» — это ожидаемо. Облачные провайдеры настраиваются в панели настроек через ключи API, хранящиеся в IndexedDB. Для сквозной проверки чата нужно либо запустить Ollama локально, либо задать облачный ключ в «Настройки → Провайдер / API Keys».

### Заметки о безопасности

- Ключи API хранятся локально в IndexedDB открытым текстом и не проходят через сервер Eiti, поскольку собственного backend-сервера у приложения нет. При обращении к облачному провайдеру соответствующий ключ API передаётся непосредственно этому провайдеру по HTTPS. Любой с доступом к профилю браузера или DevTools может прочитать локально сохранённые ключи. Клиентское «шифрование» без заданной пользователем парольной фразы было бы театром безопасности (ключ расшифровки лежал бы рядом с данными), поэтому это оставлено как задокументированный компромисс, а не как исправление.
- Строки, контролируемые пользователем и попадающие в DOM, экранируются через `escapeHtml()` (а markdown от ИИ/чата идёт через `renderMarkdown()` → DOMPurify) во избежание хранимого межсайтового скриптинга. При добавлении новых приёмников `innerHTML` экранировать любое значение от пользователя, ИИ или файлов так же.

### Ключевые файлы

| Файл | Назначение |
|---|---|
| `AGENTS.md` | Инструкции для агентов (этот файл) |
| `README.md` | Описание проекта, возможности, план развития, запуск |
| `index.html` | Основное приложение (12929 строк на HEAD `2bad547`: HTML + CSS + JS); подключает `sql-wasm.js` и `wiz-ref-memory.js` |
| `wiz-ref-memory.js` | Код подсистемы reference-memory (`wiz_ref_*`): схема, импортёр, поиск, инструменты `ref_*` |
| `docs/REFERENCE_MEMORY.md` | Спецификация reference-memory (схема, происхождение данных, инварианты, приёмка) |
| `sql-wasm.js` | Загрузчик SQLite WASM (рантайм локальной базы памяти) |
| `sql-wasm.wasm` | Бинарный модуль SQLite WASM |
| `sw.js` | Service Worker для кэширования и офлайн-поддержки (`CACHE_NAME`, `STATIC_ASSETS` с `wiz-ref-memory.js`) |
| `manifest.json` | Манифест PWA (устанавливаемость, иконки, ярлыки) |
| `tests/refmem/` | Тестовый набор reference-memory: `db.test.cjs`, `browser.test.mjs`, `scan-private.sh`, `README.md`, `fixtures/` |
| `icon-*.png` | Иконки PWA в корне репозитория (от 48×48 до 512×512) |
