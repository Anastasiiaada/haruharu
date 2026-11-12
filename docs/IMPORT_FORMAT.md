# Формат JSON HaruHaru v1

UTF-8, максимум 10 МБ. Обгортка обов’язкова: `format: "haruharu"`, `version: 1`, `type: "notes" | "words" | "exercises" | "backup"`. Масив із відповідною назвою; інші масиви мають бути відсутні або порожні. Для `backup` дозволені всі. ID — унікальні рядки всередині кожного масиву; під час імпорту створюються нові ID. Додавання не змінює наявні матеріали. До збереження показується кількість та до 15 назв.

## Конспекти (приклад для ChatGPT)

Попросіть ChatGPT: «Створи JSON HaruHaru v1, type notes за наведеним форматом. Пиши пояснення українською, корейські приклади — рівня A1. content — простий HTML для візуального редактора. Не додавай Markdown-огорожу у файл».

```json
{"format":"haruharu","version":1,"type":"notes","notes":[{"id":"teacher-1","title":"Частки теми","category":"Граматика","content":"<h2>은 / 는</h2><blockquote><p>Після голосного — 는.</p></blockquote><p>저는 학생이에요. — Я студент / студентка.</p>","demo":false,"updatedAt":0}]}
```

`category`: лише `Граматика`, `Лексика`, `Інше`. `title` — 1–200 символів, `content` — до 200000. Підтримуються `p`, `h1`–`h3`, `strong`, `em`, `ul/ol/li`, `blockquote`, `table/tbody/tr/th/td`. HTML очищується при показі та нормалізується редактором. Скрипти й обробники подій не виконуються. `demo` та `updatedAt` необов’язкові, типові значення false і 0.

## Словник

```json
{"format":"haruharu","version":1,"type":"words","words":[{"id":"apple","korean":"사과","translation":"Яблуко","category":"Їжа","example":"사과를 먹어요.","learned":false,"due":0,"interval":0,"demo":false}]}
```

Обов’язкові `id`, `korean` (1–200), `translation` (1–300), `category` (непорожній рядок). Інші поля необов’язкові: `example` типово порожній; `learned` false; `due` 0 — Unix timestamp у мілісекундах; `interval` 0 — дні, максимум 365; `demo` false.

## Вправи

```json
{"format":"haruharu","version":1,"type":"exercises","exercises":[
{"id":"particle-1","kind":"particle","topic":"Частки теми","prompt":"저___ 학생이에요.","answer":"는","options":["은","는"],"explanation":"저 закінчується на голосний.","demo":false},
{"id":"sentence-1","kind":"sentence","topic":"Порядок слів","prompt":"Складіть: Я студент / студентка.","answer":"저는 학생이에요.","tokens":["저는","학생이에요."],"explanation":"Тема перед присудком."},
{"id":"dict-1","kind":"dictation","topic":"Їжа","prompt":"Прослухайте й напишіть слово.","answer":"사과","audio":"사과"}
]}
```

Види `kind`: `choice`, `write`, `gap`, `particle`, `sentence`, `dictation`. Обов’язкові `id`, `kind`, `topic`, `prompt`, `answer`. Для `choice` та `particle` потрібен масив `options` із щонайменше двома варіантами й правильною відповіддю. Для `sentence` — `tokens` у правильному порядку, з’єднані пробілами, повинні точно дорівнювати `answer`; у вправі вони перемішуються. Для `dictation` поле `audio` — корейський текст для синтезу мовлення, не URL. `explanation` і `demo` необов’язкові.

Перевірка відповіді нормалізує Unicode NFC, регістр, зовнішні/повторні пробіли та кінцеві крапки/знаки питання/оклику. Інші відмінності залишаються значущими. Кожне граматичне завдання повинно мати одну перевірену відповідь; автоматичної лінгвістичної перевірки імпортованих матеріалів немає.

## Резервна копія

Версія 2.0 додає необов’язкові масиви `rewards` та `badges`. `rewards`: `{id,kind,reference,xp,date,correct?}`, де kind — `answer`, `review`, `mastered`, `session`, `goal`; xp — ціле 0–100, date — час збереженої дії. `badges`: `{id,date}`. Схеми — `src/game/models.ts`. Ідентифікатори журналу й значків зберігаються при відновленні, наявні записи не дублюються. Звичайний імпорт слів/конспектів/вправ не приймає ці масиви й не видає XP. `soundEffects` та `dailyGoal` включено до переносних налаштувань.

Версія 1.2 також переносить `notificationPreferences` (типи, час повторення та типовий час нових подій), `tourCompleted`, `lastSeenVersion` і `releaseSeen:<version>`. Налаштування `browser` всередині `notificationPreferences` при експорті та імпорті примусово `false`: новий браузер має отримати окремий дозвіл і явне ввімкнення. Службові помилки доставки й OAuth-стан не переносяться.

Починаючи з локальної версії 1.1, backup також містить необов’язкові масиви `calendarSources`, `localEvents`, `calendarEvents`, `icsFeeds`, `inbox`. Старі файли без них залишаються сумісними. Схеми — `src/calendar/models.ts` та `src/models.ts`. Public URL підписок і OAuth-токени не експортуються. Після відновлення Google-джерела приховані до повторного підключення, а публічні підписки стають файловим кешем і потребують повторного додавання URL. Дані відновлюються з новими ідентифікаторами; імпорт не очищує наявні.

`type: "backup"`: масиви `notes`, `words`, `exercises`, `attempts`, `exams`, `settings`. Експортуйте з налаштувань для повного зразка. `attempts`: `{id, exercise: <повний об’єкт вправи>, given: string, correct: boolean, date: ISO string}`. `exams`: `{id,date,total: positive integer,score: nonnegative integer}`. `settings`: `{key,value}`. Відновлюються налаштування `theme`, `dailyGoal`, `speechRate`; службова ознака ініціалізації не імпортується. `speechRate` — рядок `"0.75"`, `"1"` або `"1.25"`; невідоме значення читається як `"1"`. `dailyGoal` у версії 2.0 — рядок `"5"`, `"10"` або `"20"` навчальних дій; невідоме значення читається як 10.
