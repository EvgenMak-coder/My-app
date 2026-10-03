# Восточный дракон: материалы для системы взросления

Файл-референс для Claude Code. Положи его в корень проекта — Code прочитает его как ТЗ.

Собрано: 2026-10-03

---

## 0. Главное, что нужно понять до начала

**Канонические стадии взросления восточного дракона — это не выдумка и не «уровни из игры».**
В китайской традиции есть реальная зафиксированная цепочка превращений с указанием сроков.
Это даёт приложению готовый, культурно достоверный костяк прогрессии — лучше любого
набора картинок с Pinterest.

Исходная цитата (李昉 Ли Фан, «Тайпин юйлань», X в.):

> 虺五百年化爲蛟，蛟千年化爲龍，龍五百年而爲角龍，又千年爲應龍

Перевод: *хуэй через 500 лет становится цзяо; цзяо через 1000 лет становится луном;
лун через 500 лет становится цзяо-луном (рогатым); ещё через 1000 лет — ин-луном (крылатым).*

Источник: https://www.shidianguji.com/zh/mingju/7621910235519238154

---

## 1. Стадии: готовая спецификация для кода

Шесть стадий. Первая добавлена (яйцо), остальные пять — канон.

| # | Ключ | Название | Срок до следующей | Облик |
|---|------|----------|-------------------|-------|
| 0 | `egg` | Яйцо (龍蛋) | — | Каменистое яйцо с прожилками, тёплое свечение изнутри |
| 1 | `hui` | Хуэй 虺 | 500 лет | Змейка. Без ног, без рогов, без усов. Почти ящерица |
| 2 | `jiao` | Цзяо 蛟 | 1000 лет | Водный дракон. Чешуя, 4 коротких лапы, рогов нет. Живёт в воде |
| 3 | `long` | Лун 龍 | 500 лет | Классический дракон. Длинное тело, усы, грива, 4 лапы с когтями |
| 4 | `jiaolong` | Цзяо-лун 角龍 | 1000 лет | Рогатый. Полные оленьи рога, шишка 尺木 на лбу |
| 5 | `yinglong` | Ин-лун 應龍 | финал | Крылатый древний. Крылья, управляет дождём и водами |

### Как это ложится на механику приложения

- **Прогресс = время.** Канон сам задаёт неравные интервалы (500 / 1000 / 500 / 1000).
  Можно масштабировать: 1 канонический год = N секунд/действий игрока.
- **Каждая стадия добавляет одну видимую деталь.** Это идеально для кода:
  не нужно 6 разных моделей, нужна одна с переключаемыми частями.

```js
const STAGES = [
  { key:'egg',      label:'Яйцо',      cost:0,    legs:0, horns:0, whiskers:false, wings:false, len:0.3 },
  { key:'hui',      label:'Хуэй',      cost:500,  legs:0, horns:0, whiskers:false, wings:false, len:1.0 },
  { key:'jiao',     label:'Цзяо',      cost:1500, legs:4, horns:0, whiskers:false, wings:false, len:2.5 },
  { key:'long',     label:'Лун',       cost:2000, legs:4, horns:1, whiskers:true,  wings:false, len:5.0 },
  { key:'jiaolong', label:'Цзяо-лун',  cost:3000, legs:4, horns:2, whiskers:true,  wings:false, len:8.0 },
  { key:'yinglong', label:'Ин-лун',    cost:4000, legs:4, horns:2, whiskers:true,  wings:true,  len:12.0 },
];
```

---

## 2. Анатомический канон (九似, «девять подобий»)

Ван Фу, династия Хань. Это обязательный чек-лист — по нему дракон читается
как восточный, а не европейский.

| Часть | На что похожа |
|-------|---------------|
| Рога | Оленьи |
| Голова | Верблюжья |
| Глаза | Демона (в части версий — кролика) |
| Шея | Змеиная |
| Живот | Моллюска-шэнь (в части версий — лягушачий) |
| Чешуя | Карпа |
| Когти | Орлиные |
| Лапы | Тигриные |
| Уши | Коровьи |

**Числа, которые стоит зашить в генератор:**

- **117 чешуек**: 81 «ян» (положительные) + 36 «инь» (отрицательные).
  81 = 9×9, девятка — числовой символ императора.
- **尺木 (чи-му)** — шишка/нарост на лбу. Без неё дракон **не может подняться в небо**.
  Отличная механика: шишка появляется на стадии `long`, полёт разблокируется на `jiaolong`.
- **Когти**: 5 — императорский дракон, 4 — знатный, 3 — простой. Можно использовать как ранг.

Источник: https://en.wikipedia.org/wiki/Chinese_dragon

**Главное отличие от европейского дракона:** восточный дракон летает **без крыльев** —
за счёт чи-му и духовной силы. Крылья появляются только у ин-луна, и это
исключение, а не норма. Не делай крылатого дракона на ранних стадиях.

---

## 3. Ассеты, которые можно реально вставить в приложение

> Всё в этом разделе проверено на лицензию. Pinterest — **нельзя**, это раздел 4.

### 3.1 Спрайты (2D) — лучший вариант для старта

**`Dragon Asset Pack [16x16]` — DeepDiveGameStudio** ⭐ рекомендую
https://deepdivegamestudio.itch.io/dragon-asset-pack
- 45 спрайтов, idle-анимация у каждого
- **Содержит детскую версию почти каждого дракона** — ровно то, что нужно для стадий
- Free-тир (15 спрайтов) → $2 (ещё 15) → $4 (ещё 15)
- Коммерческое использование разрешено, атрибуция не обязательна
- Нельзя: перепродавать, NFT

**Elthen's Pixel Art Shop — Dragons Bundle**
https://elthen.itch.io/2d-pixel-art-dragon-hatchling-sprites — детёныш, $3
https://elthen.itch.io/2d-pixel-art-elder-dragon-hatchling — древний детёныш
- Бандл из 6 паков — $25
- Анимации: Idle, Move, Attack, Hurt, Death
- Коммерческое использование разрешено (детали лицензии — на Patreon автора)

**RPG Enemies: 11 Dragons** — бесплатно, CC-BY 3.0
https://opengameart.org/content/rpg-enemies-11-dragons
- Среди 11 драконов есть именно **Ancient dragon** и **Juvenile dragon**
- ⚠️ Стиль западный, не восточный. Брать как структуру стадий, не как внешний вид
- Атрибуция обязательна: Stephen "Redshrike" Challener

**Яйцо и вылупление:**
https://nightspore.itch.io/hatching-egg-sprites

### 3.2 3D-модели (three.js / react-three-fiber)

**Chinese Dragon with skeletal animation — haber_n** ⭐ рекомендую
https://sketchfab.com/3d-models/chinese-dragon-with-skeletal-animation-aa2b2d6a023d4e9da2425e81844fe5c5
- **4 282 полигона** — вес отличный для веба
- Готовый скелет + анимация. Скелет = можно масштабировать и гнуть под все стадии
- CC-BY (нужна ссылка на автора)

Остальные бесплатные, все CC-BY:
- https://sketchfab.com/3d-models/chinese-dragon-a51349efd84643afb97ec370ea0c612d (Krokki_)
- https://sketchfab.com/3d-models/chinese-dragon-5f150cd861a245008045b89cdb6fbb7c (icenvain)
- https://sketchfab.com/3d-models/lowpoly-textured-chinese-dragon-4021eb82c1964cb8bd7618a8b4117d8c (Khyoocumber)
- https://sketchfab.com/3d-models/chinese-dragon-lowpoly-1fbc49821d704671bad91ed27d2e89a6 (KaraBulba4ka)
- Коллекция драконов: https://sketchfab.com/TheGermanCharizard/collections/downloadable-dragons-652db50691484b0b966d72b2aeae3eba

> ⚠️ **Не бери модели `Black Myth: Wukong` от hakudragons со Sketchfab.**
> Они помечены CC-BY, но это рипы из коммерческой игры — загрузивший не имел права
> выдавать на них лицензию. По 178 000 полигонов, для веба всё равно неподъёмно.

### 3.3 Lottie-анимации (самый лёгкий путь для веба)

- https://lottiefiles.com/free-animations/dragon — бесплатные драконы
- https://lottiefiles.com/free-animations/dragon-flying — в полёте
- https://lottiefiles.com/marketplace/chinese-dragon-totem — пак «Chinese Dragon Totem»
- https://iconscout.com/lottie-animations/chinese-dragon — китайские драконы, GIF + Lottie JSON

Лицензию проверяй у каждого файла отдельно — на LottieFiles они разные.

### 3.4 SVG / вектор (public domain)

- https://freesvg.org/asian-dragon
- https://freesvg.org/chinese-dragon
- https://publicdomainvectors.org/en/oriental-dragon-clipart
- https://commons.wikimedia.org/wiki/File:Chinese_Dragon.svg

---

## 4. Мудборд: Pinterest (только для стиля, НЕ для вставки)

> Это чужие работы под авторским правом. Годятся показать художнику или
> описать Code словами «сделай в таком духе». Вставлять в приложение нельзя.

**Поисковые запросы, которые реально работают:**

Структура стадий и размерные чарты (лучший запрос):
https://ru.pinterest.com/search/pins/?q=dragon%20evolution%20stages%20baby%20to%20adult%20concept%20art

Там находятся: лист «Evolution of Dragons», размерный чарт (small → large → huge →
gargantuan), прогрессия головы по возрасту, чарт «Ages of Life».

Восточная стилистика:
https://ru.pinterest.com/search/pins/?q=chinese%20dragon%20concept%20art

Отдельные пины со стадиями (проверены глазами):
- https://ru.pinterest.com/pin/4433299630827085/
- https://ru.pinterest.com/pin/271201208807240145/
- https://ru.pinterest.com/pin/53480314318283782/
- https://ru.pinterest.com/pin/31384528648902403/
- https://ru.pinterest.com/pin/693343305179337260/

⚠️ В выдаче по «китайским драконам» сейчас очень много ИИ-генерации с кривой
анатомией. У Pinterest есть кнопка **«Меньше ИИ»** над результатами — включи её.

---

## 5. Рекомендация по технической реализации

Не ищи 6 отдельных моделей — это тупик: они не будут стыковаться между собой,
и переход между стадиями получится скачком.

**Делай одного процедурного дракона:**

1. **Тело — кривая.** Восточный дракон это лента, а не зверь. Catmull-Rom сплайн,
   вдоль него — сегменты. Рост = увеличение числа сегментов и длины кривой.
2. **Движение — волна.** `segment[i].y += sin(t * speed + i * phase) * amplitude`.
   Это и есть вся «анимация» — классическое змеиное скольжение.
3. **Части тела — флаги.** Лапы, рога, усы, грива, крылья включаются по
   таблице стадий из раздела 1. Переход между стадиями — плавная интерполяция
   масштаба + fade-in новой части.
4. **Чешуя — шейдер или паттерн**, а не 117 отдельных объектов.

Такой подход даёт бесшовный рост от яйца до ин-луна и весит в разы меньше,
чем набор готовых моделей. Готовые модели из раздела 3.2 бери как
визуальный ориентир пропорций.

---

## Источники

- [Taiping Yulan — цитата о стадиях (李昉)](https://www.shidianguji.com/zh/mingju/7621910235519238154)
- [Chinese dragon — Wikipedia (九似, чешуя, 尺木)](https://en.wikipedia.org/wiki/Chinese_dragon)
- [Tianlong — Wikipedia](https://en.wikipedia.org/wiki/Tianlong)
- [Эволюция от змеи к дракону — Zhihu](https://www.zhihu.com/question/277081445)
- [Различия 蛟龙/螭龙/虬龙/角龙/应龙 — Sohu](https://www.sohu.com/a/768499187_100042272)
- [Dragon Asset Pack — itch.io](https://deepdivegamestudio.itch.io/dragon-asset-pack)
- [Elthen's Dragon Hatchling Sprites — itch.io](https://elthen.itch.io/2d-pixel-art-dragon-hatchling-sprites)
- [RPG Enemies: 11 Dragons — OpenGameArt](https://opengameart.org/content/rpg-enemies-11-dragons)
- [Chinese Dragon with skeletal animation — Sketchfab](https://sketchfab.com/3d-models/chinese-dragon-with-skeletal-animation-aa2b2d6a023d4e9da2425e81844fe5c5)
- [LottieFiles — Dragon animations](https://lottiefiles.com/free-animations/dragon)
