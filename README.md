# StaySafeBG

StaySafeBG е уеб приложение за превенция на онлайн измами. Потребителите могат да проверяват съмнителни линкове/домейни/имейли, да подават сигнали за измами с доказателства и да четат обучителни материали (tips). Платформата използва Supabase за автентикация, база данни, Storage и Edge Functions.

## 1) Project description

### Основни функции
- Проверка за измама (`scam-check`) чрез комбиниране на:
   - локални данни (одобрени сигнали),
   - списъци с познати phishing домейни,
   - списък със зловредни ресурси,
   - външни източници през Edge Function (`threat-check`).
- Подаване на сигнал за измама (`report-scam`) с прикачени файлове.
- Публични и административни обучителни статии (`tips`).
- Community секция с одобрени сигнали.

### Роли и достъп (кой какво може)
- **Анонимен потребител**:
   - достъп до публично съдържание (публикувани tips, approved сигнали, активни публични threat записи по RLS);
   - проверка в `scam-check`.
- **Регистриран потребител (`user`)**:
   - всички права на анонимен;
   - създаване на собствени сигнали (статус `pending`);
   - достъп до собствените си сигнали и файлове.
- **Модератор (`moderator`)**:
   - управление на сигнали (преглед/редакция/статус);
   - управление на tips;
   - управление на `trusted_phishing_domains` и `malicious_resources`.
- **Админ (`admin`)**:
   - всички права на модератор;
   - управление на потребители и роли (RPC функции).

## 2) Architecture

### Front-end
- Multi-page приложение с **Vite + Vanilla JavaScript + Bootstrap**.
- HTML entry points: `index.html`, `login.html`, `register.html`, `tips.html`, `tips-details.html`, `article-details.html`, `scam-check.html`, `report-scam.html`, `community.html`, `admin.html`.
- Page modules в `src/pages/` и преизползваеми компоненти в `src/components/`.

### Back-end (BaaS)
- **Supabase Auth**: регистрация, логин, сесии.
- **Supabase Postgres**: бизнес таблици + RLS политики + RPC функции.
- **Supabase Storage**: bucket `evidence` за файлове към сигнали.
- **Supabase Edge Function**: `supabase/functions/threat-check/index.ts` за агрегирана външна проверка.

### Технологии
- Front-end: `vite`, `bootstrap`, `@supabase/supabase-js`
- Back-end: Supabase (Postgres, Auth, Storage, Edge Functions)
- SQL миграции: `supabase/migrations/*.sql`

## 3) Database schema design

Основни таблици и връзки:

```mermaid
erDiagram
   AUTH_USERS {
      uuid id PK
   }

   PROFILES {
      uuid id PK, FK
      text email
      text full_name
      timestamptz created_at
   }

   USER_ROLES {
      uuid user_id PK, FK
      text role
      timestamptz created_at
   }

   TIPS {
      uuid id PK
      text title
      text content
      text category
      uuid author_id FK
      boolean is_published
      timestamptz created_at
   }

   SCAM_REPORTS {
      uuid id PK
      text title
      text description
      text category
      text status
      uuid created_by FK
      timestamptz created_at
   }

   REPORT_FILES {
      uuid id PK
      uuid report_id FK
      text file_path
      text mime_type
      timestamptz created_at
   }

   TRUSTED_PHISHING_DOMAINS {
      uuid id PK
      text domain UNIQUE
      numeric confidence
      text risk_level
      boolean is_active
      uuid created_by FK
      timestamptz updated_at
   }

   MALICIOUS_RESOURCES {
      uuid id PK
      text resource_value
      text normalized_value
      text resource_type
      text risk_level
      text status
      boolean is_active
      uuid created_by FK
      timestamptz updated_at
   }

   AUTH_USERS ||--|| PROFILES : has
   AUTH_USERS ||--|| USER_ROLES : has
   AUTH_USERS ||--o{ TIPS : authors
   AUTH_USERS ||--o{ SCAM_REPORTS : creates
   SCAM_REPORTS ||--o{ REPORT_FILES : contains
   AUTH_USERS ||--o{ TRUSTED_PHISHING_DOMAINS : creates
   AUTH_USERS ||--o{ MALICIOUS_RESOURCES : creates
```

> Забележка: в migration history таблицата за статии е преименувана от `articles` -> `news` -> `tips`.

## 4) Local development setup guide

### 1. Prerequisites
- Node.js 18+ и npm
- Supabase проект (за реални данни/автентикация)

### 2. Инсталация
```bash
npm install
```

### 3. Environment variables
Копирай `.env.example` в `.env` и попълни:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### 4. Стартиране
```bash
npm run dev
```

### 5. Build / Preview
```bash
npm run build
npm run preview
```

### 6. (Optional, recommended) Edge Function `threat-check`
За най-добър резултат от `scam-check`, деплойни Edge Function-а:
- код: `supabase/functions/threat-check/index.ts`
- optional secrets:
   - `GOOGLE_SAFE_BROWSING_API_KEY`
   - `VIRUSTOTAL_API_KEY`

Ако функцията не е налична, фронтендът използва fallback проверка.

## 5) Key folders and files

### Root
- `index.html`, `login.html`, `register.html`, `tips.html`, `tips-details.html`, `article-details.html`, `scam-check.html`, `report-scam.html`, `community.html`, `admin.html` — отделни входни точки за страниците.
- `vite.config.js` — multi-page build конфигурация за Vite.
- `package.json` — зависимости и скриптове.

### `src/`
- `src/pages/` — page-level логика по страници.
- `src/components/` — преизползваеми UI части (`header.js`, `footer.js`).
- `src/services/` — слой за достъп до Supabase и бизнес операции:
   - `authService.js`, `rolesService.js`
   - `reportsService.js`, `storageService.js`
   - `tipsService.js`
   - `trustedDomainsService.js`, `maliciousResourcesService.js`
   - `scamCheckService.js`
   - `adminUsersService.js`
   - `supabaseClient.js`
- `src/styles/` — стилове по страници + общи theme/main стилове.
- `src/utils/notifications.js` — helper за нотификации.

### `supabase/`
- `supabase/migrations/` — SQL миграции (append-only).
- `supabase/functions/threat-check/index.ts` — Edge Function за threat aggregation и risk scoring.

## 6) Notes for contributors

- Не променяй вече приложени миграции; добавяй нови.
- Пази синхрон между локални миграции и Supabase migration history.
- Достъпите са контролирани през RLS и роли (`user`, `moderator`, `admin`).
