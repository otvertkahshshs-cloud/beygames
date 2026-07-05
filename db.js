const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const USE_PG = !!process.env.DATABASE_URL;

// ─── PostgreSQL ────────────────────────────────────────────────────────────────
let pgPool;
if (USE_PG) {
    const { Pool } = require('pg');
    pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });
}

// ─── SQLite (локально) ────────────────────────────────────────────────────────
let sqliteDb;
if (!USE_PG) {
    const Database = require('better-sqlite3');
    const DB_PATH = path.join(__dirname, 'data', 'forum.db');
    sqliteDb = new Database(DB_PATH);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');
}

// ─── Универсальный query ───────────────────────────────────────────────────────
async function query(sql, params = []) {
    if (USE_PG) {
        const result = await pgPool.query(sql, params);
        return result.rows;
    }

    // SQLite: конвертируем $1/$2 → ?
    let s = sql.replace(/\$(\d+)/g, '?');
    s = s.replace(/TIMESTAMPTZ/gi, 'TEXT');
    s = s.replace(/BOOLEAN/gi, 'INTEGER');
    s = s.replace(/JSONB/gi, 'TEXT');
    s = s.replace(/NOW\(\)/gi, "datetime('now')");

    const returning = /RETURNING \*/i.test(s);
    if (returning) {
        s = s.replace(/\s*RETURNING \*/i, '');
        sqliteDb.prepare(s).run(...params);
        const m = s.match(/INSERT INTO (\w+)/i);
        if (m) {
            const row = sqliteDb.prepare(`SELECT * FROM ${m[1]} WHERE id=?`).get(params[0]);
            return row ? [row] : [];
        }
        return [];
    }

    const stmt = sqliteDb.prepare(s);
    if (/^\s*(SELECT|WITH)/i.test(s)) return stmt.all(...params);
    stmt.run(...params);
    return [];
}

// ─── Инициализация БД ─────────────────────────────────────────────────────────
async function init() {
    if (USE_PG) {
        await initPostgres();
    } else {
        initSQLite();
    }
}

// ─── PostgreSQL init ──────────────────────────────────────────────────────────
async function initPostgres() {
    await pgPool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            avatar TEXT DEFAULT '/img/default_avatar.png',
            banner TEXT DEFAULT '',
            role TEXT DEFAULT 'user',
            rank TEXT DEFAULT 'Новичок',
            posts_count INTEGER DEFAULT 0,
            reputation INTEGER DEFAULT 0,
            signature TEXT DEFAULT '',
            banned INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS cats (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            icon TEXT DEFAULT '',
            sort INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS sections (
            id TEXT PRIMARY KEY,
            cat_id TEXT REFERENCES cats(id),
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            icon TEXT DEFAULT '',
            sort INTEGER DEFAULT 0,
            threads_count INTEGER DEFAULT 0,
            posts_count INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS threads (
            id TEXT PRIMARY KEY,
            section_id TEXT REFERENCES sections(id),
            user_id TEXT REFERENCES users(id),
            title TEXT NOT NULL,
            views INTEGER DEFAULT 0,
            replies INTEGER DEFAULT 0,
            pinned INTEGER DEFAULT 0,
            locked INTEGER DEFAULT 0,
            status TEXT DEFAULT 'approved',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            last_post_at TIMESTAMPTZ DEFAULT NOW(),
            last_post_user TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY,
            thread_id TEXT REFERENCES threads(id),
            user_id TEXT REFERENCES users(id),
            content TEXT NOT NULL,
            image TEXT,
            attachment TEXT,
            likes INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS likes (
            user_id TEXT REFERENCES users(id),
            post_id TEXT REFERENCES posts(id),
            PRIMARY KEY (user_id, post_id)
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT REFERENCES users(id),
            text TEXT NOT NULL,
            link TEXT DEFAULT '',
            read INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS tickets (
            id TEXT PRIMARY KEY,
            user_id TEXT REFERENCES users(id),
            username TEXT NOT NULL,
            subject TEXT NOT NULL,
            status TEXT DEFAULT 'open',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS ticket_replies (
            id TEXT PRIMARY KEY,
            ticket_id TEXT REFERENCES tickets(id),
            user_id TEXT REFERENCES users(id),
            username TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS chat_messages (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            avatar TEXT DEFAULT '/img/default_avatar.png',
            message TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);

    await syncCatsAndSectionsAsync();

    const adminUser = await pgPool.query("SELECT id FROM users WHERE role='admin' LIMIT 1");
    if (!adminUser.rows.length) {
        const hash = bcrypt.hashSync('admin123', 10);
        await pgPool.query(
            'INSERT INTO users(id,username,email,password,role,rank) VALUES($1,$2,$3,$4,$5,$6)',
            [uuidv4(), 'admin', 'admin@forum.ru', hash, 'admin', 'KITTY:3']
        );
        console.log('PG seeded. admin / admin123');
    }
}

// ─── SQLite init ──────────────────────────────────────────────────────────────
function initSQLite() {
    sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            avatar TEXT DEFAULT '/img/default_avatar.png',
            role TEXT DEFAULT 'user',
            rank TEXT DEFAULT 'Новичок',
            posts_count INTEGER DEFAULT 0,
            reputation INTEGER DEFAULT 0,
            signature TEXT DEFAULT '',
            banned INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS cats (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            icon TEXT DEFAULT '',
            sort INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS sections (
            id TEXT PRIMARY KEY,
            cat_id TEXT REFERENCES cats(id),
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            icon TEXT DEFAULT '',
            sort INTEGER DEFAULT 0,
            threads_count INTEGER DEFAULT 0,
            posts_count INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS threads (
            id TEXT PRIMARY KEY,
            section_id TEXT REFERENCES sections(id),
            user_id TEXT REFERENCES users(id),
            title TEXT NOT NULL,
            views INTEGER DEFAULT 0,
            replies INTEGER DEFAULT 0,
            pinned INTEGER DEFAULT 0,
            locked INTEGER DEFAULT 0,
            status TEXT DEFAULT 'approved',
            created_at TEXT DEFAULT (datetime('now')),
            last_post_at TEXT DEFAULT (datetime('now')),
            last_post_user TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY,
            thread_id TEXT REFERENCES threads(id),
            user_id TEXT REFERENCES users(id),
            content TEXT NOT NULL,
            image TEXT,
            attachment TEXT,
            likes INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS likes (
            user_id TEXT REFERENCES users(id),
            post_id TEXT REFERENCES posts(id),
            PRIMARY KEY (user_id, post_id)
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT REFERENCES users(id),
            text TEXT NOT NULL,
            link TEXT DEFAULT '',
            read INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS tickets (
            id TEXT PRIMARY KEY,
            user_id TEXT REFERENCES users(id),
            username TEXT NOT NULL,
            subject TEXT NOT NULL,
            status TEXT DEFAULT 'open',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS ticket_replies (
            id TEXT PRIMARY KEY,
            ticket_id TEXT REFERENCES tickets(id),
            user_id TEXT REFERENCES users(id),
            username TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            avatar TEXT DEFAULT '/img/default_avatar.png',
            message TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );
    `);

    // Миграции колонок
    try { sqliteDb.exec("ALTER TABLE users ADD COLUMN banner TEXT DEFAULT ''"); } catch(e) {}

    syncCatsAndSectionsSync();

    const adminUser = sqliteDb.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
    if (!adminUser) {
        const hash = bcrypt.hashSync('admin123', 10);
        sqliteDb.prepare('INSERT INTO users(id,username,email,password,role,rank) VALUES(?,?,?,?,?,?)').run(
            uuidv4(), 'admin', 'admin@forum.ru', hash, 'admin', 'KITTY:3'
        );
        console.log('SQLite seeded. admin / admin123');
    }
}

// ─── Sync cats/sections ───────────────────────────────────────────────────────
async function syncCatsAndSectionsAsync() {
    const existing = await pgPool.query('SELECT id FROM cats LIMIT 1');
    if (existing.rows.length) return; // уже есть — не трогаем

    const c1 = uuidv4();
    await pgPool.query(
        'INSERT INTO cats VALUES($1,$2,$3,$4,$5)',
        [c1, 'Читы и Хаки', 'Всё для игровых читов', '<i class="fa-solid fa-crosshairs"></i>', 1]
    );
    await pgPool.query(
        'INSERT INTO sections(id,cat_id,name,description,icon,sort,threads_count,posts_count) VALUES($1,$2,$3,$4,$5,$6,0,0)',
        [uuidv4(), c1, 'Counter-Strike: Global Offensive', 'Читы для CS:GO',
            '<span class="cs2-icon-wrap"><img src="/img/csgo.png" alt="CS2" class="cs2-sec-icon"></span>', 1]
    );
    console.log('PG cats & sections seeded.');
}

function syncCatsAndSectionsSync() {
    sqliteDb.pragma('foreign_keys = OFF');
    sqliteDb.prepare('DELETE FROM sections').run();
    sqliteDb.prepare('DELETE FROM cats').run();
    sqliteDb.pragma('foreign_keys = ON');

    const c1 = uuidv4();
    sqliteDb.prepare('INSERT INTO cats VALUES (?,?,?,?,?)').run(
        c1, 'Читы и Хаки', 'Всё для игровых читов', '<i class="fa-solid fa-crosshairs"></i>', 1
    );
    sqliteDb.prepare(
        'INSERT INTO sections(id,cat_id,name,description,icon,sort,threads_count,posts_count) VALUES(?,?,?,?,?,?,0,0)'
    ).run(
        uuidv4(), c1, 'Counter-Strike: Global Offensive', 'Читы для CS:GO',
        '<span class="cs2-icon-wrap"><img src="/img/csgo.png" alt="CS2" class="cs2-sec-icon"></span>', 1
    );
    console.log('SQLite cats & sections synced.');
}

module.exports = { query, uuidv4, init };
