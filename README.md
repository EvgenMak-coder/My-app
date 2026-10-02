# Небесный дракон

Личное приложение для роста в стиле восточного фэнтези: навыки с рангами, Колесо жизни, опыт (ци) и дракон, который проходит стадии культивации вместе с владельцем. Работает в браузере на ПК и телефоне, ставится как PWA.

## Запуск

Нужен Node.js 20+.

```bash
npm install
npm run dev
```

Без настроек данные хранятся в браузере (localStorage).

## Синхронизация через Supabase

1. Создай проект на supabase.com.
2. SQL Editor → выполни `supabase/migrations/0001_init.sql`.
3. Authentication → Users → Add user: заведи себе почту и пароль. Затем в Sign In / Providers отключи регистрацию новых пользователей.
4. Скопируй `.env.example` в `.env.local` и впиши Project URL и anon key.

Все таблицы закрыты RLS: без входа данные недоступны, anon key можно хранить в собранном сайте.

## Перенос из Excel

```bash
python scripts/import_excel.py "путь/к/Небесный дракон.xlsx"
```

Получится `seed.local.json` (в git не попадает). Загрузи его: Настройки → Импорт.

## Команды

- `npm run test` — тесты рангов и опыта
- `npm run build` — сборка в `dist/`

## Деплой

`.github/workflows/deploy.yml` собирает и публикует на GitHub Pages при push в `main`. В Settings → Secrets репозитория добавь `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`, в Settings → Pages выбери источник «GitHub Actions».

## Устройство

- `src/game` — правила: ранги (`ranks.ts`), опыт и стадии дракона (`xp.ts`)
- `src/data` — хранилище: общий интерфейс `DataStore`, реализации для localStorage и Supabase, действия в `actions.ts`
- `src/features` — экраны: главная, навыки, статистика, настройки, заглушки будущих разделов
