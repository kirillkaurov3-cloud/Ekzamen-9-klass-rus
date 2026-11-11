# Запятая

Тренажёр ОГЭ по русскому: темы и номера, мини-варианты с таймером, повторение ошибок, теория и статистика. Прогресс хранится на устройстве в IndexedDB. Публичная сборка содержит собственные демозадания.

Сайт: https://kirillkaurov3-cloud.github.io/Ekzamen-9-klass-rus/

Выполненные этапы, фактические проверки и оставшиеся задачи: [PROGRESS.md](PROGRESS.md).

## Запуск

Node.js **24.22.1** из `.nvmrc`, npm и Python 3.10+ для тестов импортера.

```bash
npm ci
npm run dev
```

Dev: `http://localhost:5173`. Для production и офлайна:

```bash
npm run build
npm run preview
```

Preview: `http://localhost:4173`. Для установки откройте HTTPS-сайт; на iPhone — Safari → «Поделиться» → «На экран Домой». Сначала загрузите сайт с сетью. Обновление предлагается кнопкой после завершения активной серии. Очистка данных сайта удаляет локальный прогресс; облачная синхронизация пока не реализована.

## Проверки

```bash
npm run lint
npm run typecheck
npm test
npm run content:validate
npm run build
npx playwright install chromium --only-shell
npm run test:e2e
```

На Linux без системных библиотек Chromium используйте установку Playwright с `--with-deps`. E2E автоматически собирает приложение и запускает preview. Скриншоты и трассы находятся в `test-results/`; в CI — в артефактах `browser-results-*`.

Путь GitHub Pages проверяется отдельно:

```bash
OGE_BASE_PATH=/Ekzamen-9-klass-rus/ npm run test:e2e
# Для ручного preview с префиксом:
OGE_BASE_PATH=/Ekzamen-9-klass-rus/ npm run build
OGE_BASE_PATH=/Ekzamen-9-klass-rus/ npm run preview
```

## Локальный импорт PDF

Нужен Poppler (`pdftotext`). Исходник, пакет, текст, корректировки и отчёты остаются в игнорируемых `content-source/` и `content-private/`. Они не попадают в публичную сборку.

```bash
mkdir -p content-source
# Поместите PDF в content-source либо укажите его путь в --input.
python3 scripts/import-pdf.py \
  --input content-source/Tematicheskiy_praktikum_2026-2027-2.pdf \
  --output-dir content-private/praktikum-2027
npm run content:validate -- content-private/praktikum-2027/pack.json
```

Загрузить готовый `pack.json` можно через настройки сайта. Файл обрабатывается и сохраняется на устройстве. При новой версии набора история сохраняется; изменение самого задания требует увеличения его `version`.

Импортер проверяет 545 страниц и границы разделов, сохраняет составные адреса и физические страницы. `REPORT.md`, `report.json` и `review.json` описывают реальное покрытие; наличие автоматического ключа не означает ручной сверки всего задания. Полнота переноса пока не подтверждена.

Теория связана с темами как фрагменты по страницам; блок `preformatted` сохраняет колонки и переносы. Семантическая разметка таблиц и просмотр оригинального PDF ещё не завершены.

Неоднозначные задания №12 доступны с отметкой «Ключ на сверке»: `reviewRequired: true`, тип `self`, без таймера и оценки. Очередь сверки включает эти записи, поэтому метрики «самопроверка» и «на сверке» пересекаются.

Ручные корректировки находятся в локальном `corrections.json`. Читаемые формы №9 (`answerForms`) должны сохранять все слова и альтернативы исходного ключа. Полная ручная запись (`task`) должна сохранять составной адрес и страницы. Оба вида привязываются к `sourceSha256` и `sourceKey`; другая редакция или ключ останавливают импорт. Флаг `--corrections` позволяет указать отдельный файл. Повторный запуск сохраняет ручные корректировки и воспроизводит пакет.

## Публикация

Источник GitHub Pages — **GitHub Actions**. Ручной workflow собирает и проверяет `dist`, вычисляя базовый путь из имени репозитория. Обычный push запускает CI, но не публикует сайт.

```bash
gh workflow run pages.yml --ref codex/zapyataya-pwa
gh run list --workflow pages.yml
npm run site:check -- https://kirillkaurov3-cloud.github.io/Ekzamen-9-klass-rus/
```

После деплоя проверьте публичный сайт в чистом браузере: прямую ссылку в каталог, решение с разбором, сохранение после перезагрузки и офлайн. Проверка ресурсов через `site:check` не заменяет этот сценарий. Установка на реальных iPhone/Android проверяется отдельно от эмуляции Chromium.
