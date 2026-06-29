/**
 * fix-sections.js
 * Запусти: node fix-sections.js
 *
 * Что делает:
 * 1. Удаляет все категории и разделы (cascade)
 * 2. Пересоздаёт нужные: только CS:GO в "Читы и Хаки"
 */

const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const db = new Database(path.join(__dirname, 'data', 'forum.db'));
db.pragma('foreign_keys = OFF'); // отключаем FK чтобы удалить без ошибок каскада

// Удаляем всё старое
db.prepare('DELETE FROM sections').run();
db.prepare('DELETE FROM cats').run();

db.pragma('foreign_keys = ON');

// Создаём категории заново
const c1 = uuidv4(), c2 = uuidv4(), c3 = uuidv4(), c4 = uuidv4();

db.prepare('INSERT INTO cats VALUES (?,?,?,?,?)').run(c1, 'Читы и Хаки',  'Всё для игровых читов', '<i class="fa-solid fa-crosshairs"></i>', 1);
db.prepare('INSERT INTO cats VALUES (?,?,?,?,?)').run(c2, 'Игры',         'Обсуждение игр',        '<i class="fa-solid fa-gamepad"></i>',    2);
db.prepare('INSERT INTO cats VALUES (?,?,?,?,?)').run(c3, 'Маркет',       'Купля и продажа',       '<i class="fa-solid fa-tag"></i>',        3);
db.prepare('INSERT INTO cats VALUES (?,?,?,?,?)').run(c4, 'Общение',      'Флуд и общение',        '<i class="fa-solid fa-comments"></i>',   4);

// Создаём разделы
const secs = [
    // Читы и Хаки — только CS:GO
    [uuidv4(), c1, 'Counter-Strike: Global Offensive', 'Читы для CS:GO', '<i class="fa-solid fa-gun"></i>', 1],

    // Игры
    [uuidv4(), c2, 'Counter-Strike: Global Offensive', 'Обсуждение CS:GO', '<i class="fa-solid fa-gun"></i>', 1],
    [uuidv4(), c2, 'Другие игры',                      'Прочие игры',      '<i class="fa-solid fa-dice"></i>', 2],

    // Маркет
    [uuidv4(), c3, 'Аккаунты', 'Продажа аккаунтов', '<i class="fa-solid fa-user"></i>',   1],
    [uuidv4(), c3, 'Услуги',   'Игровые услуги',    '<i class="fa-solid fa-wrench"></i>', 2],

    // Общение
    [uuidv4(), c4, 'Флудилка',   'Общение обо всём', '<i class="fa-solid fa-fire"></i>',      1],
    [uuidv4(), c4, 'Знакомства', 'Найди друзей',     '<i class="fa-solid fa-handshake"></i>', 2],
];

for (const s of secs)
    db.prepare('INSERT INTO sections(id,cat_id,name,description,icon,sort,threads_count,posts_count) VALUES(?,?,?,?,?,?,0,0)').run(...s);

console.log('✅ Готово! Категории и разделы обновлены.');
db.close();
