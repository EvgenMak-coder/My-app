-- Желания: степень важности — металл монеты (0 бронза, 1 серебро, 2 золото, 3 нефрит).
-- Уже записанные желания получают бронзу; владелец перевыбирает сам.

alter table wishes add column level int not null default 0 check (level between 0 and 3);
