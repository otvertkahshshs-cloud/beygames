const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'forum.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Adapter: same async API as pg, converts $1/$2 -> ?, translates pg syntax
async function query(sql, params = []) {
    let s = sql.replace(/\$(\d+)/g, '?');
    s = s.replace(/TIMESTAMPTZ/gi, 'TEXT');
    s = s.replace(/BOOLEAN/gi, 'INTEGER');
    s = s.replace(/JSONB/gi, 'TEXT');
    s = s.replace(/NOW\(\)/gi, "datetime('now')");

    // Handle RETURNING * — run INSERT then SELECT the row back
    const returning = /RETURNING \*/i.test(s);
    if (returning) {
        s = s.replace(/\s*RETURNING \*/i, '');
        db.prepare(s).run(...params);
        const m = s.match(/INSERT INTO (\w+)/i);
        if (m) {
            const row = db.prepare(`SELECT * FROM ${m[1]} WHERE id=?`).get(params[0]);
            return row ? [row] : [];
        }
        return [];
    }

    const stmt = db.prepare(s);
    if (/^\s*(SELECT|WITH)/i.test(s)) {
        return stmt.all(...params);
    } else {
        stmt.run(...params);
        return [];
    }
}

async function init() {
    db.exec(`
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

    migrateFromJson();

    // Принудительно обновляем категории и разделы до актуального состояния
    syncCatsAndSections();

    const adminUser = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
    if (!adminUser) {
        const hash = bcrypt.hashSync('admin123', 10);
        db.prepare('INSERT INTO users(id,username,email,password,role,rank) VALUES(?,?,?,?,?,?)').run(uuidv4(),'admin','admin@forum.ru',hash,'admin','Администратор');
        console.log('DB seeded. admin / admin123');
    }
}

function syncCatsAndSections() {
    // Удаляем все категории и разделы, пересоздаём нужные
    db.pragma('foreign_keys = OFF');
    db.prepare('DELETE FROM sections').run();
    db.prepare('DELETE FROM cats').run();
    db.pragma('foreign_keys = ON');

    const c1 = uuidv4();
    db.prepare('INSERT INTO cats VALUES (?,?,?,?,?)').run(c1,'Читы и Хаки','Всё для игровых читов','<i class="fa-solid fa-crosshairs"></i>',1);

    const secs = [
        [uuidv4(),c1,'Counter-Strike: Global Offensive','Читы для CS:GO','<i class="fa-solid fa-gun"></i>',1],
    ];
    for (const s of secs)
        db.prepare('INSERT INTO sections(id,cat_id,name,description,icon,sort,threads_count,posts_count) VALUES(?,?,?,?,?,?,0,0)').run(...s);

    console.log('Cats & sections synced.');
}

function migrateFromJson() {
    const dataDir = path.join(__dirname, 'data');

    if (!db.prepare('SELECT id FROM cats LIMIT 1').get()) {
        const f = path.join(dataDir, 'cats.json');
        if (fs.existsSync(f)) {
            for (const c of JSON.parse(fs.readFileSync(f, 'utf8')))
                db.prepare('INSERT OR IGNORE INTO cats VALUES(?,?,?,?,?)').run(c._id, c.name, c.description||'', c.icon||'', c.sort||0);
        }
    }

    if (!db.prepare('SELECT id FROM sections LIMIT 1').get()) {
        const f = path.join(dataDir, 'sections.json');
        if (fs.existsSync(f)) {
            for (const s of JSON.parse(fs.readFileSync(f, 'utf8')))
                db.prepare('INSERT OR IGNORE INTO sections(id,cat_id,name,description,icon,sort,threads_count,posts_count) VALUES(?,?,?,?,?,?,?,?)').run(
                    s._id, s.catId, s.name, s.desc||'', s.icon||'', s.sort||0, s.threadsCount||0, s.postsCount||0);
        }
    }

    if (!db.prepare('SELECT id FROM users LIMIT 1').get()) {
        const f = path.join(dataDir, 'users.json');
        if (fs.existsSync(f)) {
            for (const u of JSON.parse(fs.readFileSync(f, 'utf8')))
                db.prepare('INSERT OR IGNORE INTO users(id,username,email,password,avatar,role,rank,posts_count,reputation,signature,banned,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(
                    u._id, u.username, u.email, u.password, u.avatar||'/img/default_avatar.png',
                    u.role||'user', u.rank||'Новичок', u.postsCount||0, u.reputation||0,
                    u.signature||'', u.banned?1:0, u.createdAt||new Date().toISOString());
        }
    }

    if (!db.prepare('SELECT id FROM threads LIMIT 1').get()) {
        const f = path.join(dataDir, 'threads.json');
        if (fs.existsSync(f)) {
            const threads = JSON.parse(fs.readFileSync(f, 'utf8'));
            if (Array.isArray(threads))
                for (const t of threads)
                    db.prepare('INSERT OR IGNORE INTO threads(id,section_id,user_id,title,views,replies,pinned,locked,status,created_at,last_post_at,last_post_user) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(
                        t._id, t.sectionId, t.userId, t.title, t.views||0, t.replies||0,
                        t.pinned?1:0, t.locked?1:0, t.status||'approved',
                        t.createdAt||new Date().toISOString(), t.lastPostAt||new Date().toISOString(), t.lastPostUser||'');
        }
    }

    if (!db.prepare('SELECT id FROM posts LIMIT 1').get()) {
        const f = path.join(dataDir, 'posts.json');
        if (fs.existsSync(f)) {
            const posts = JSON.parse(fs.readFileSync(f, 'utf8'));
            if (Array.isArray(posts))
                for (const p of posts)
                    db.prepare('INSERT OR IGNORE INTO posts(id,thread_id,user_id,content,image,attachment,likes,created_at) VALUES(?,?,?,?,?,?,?,?)').run(
                        p._id, p.threadId, p.userId, p.content, p.image||null,
                        p.attachment ? JSON.stringify(p.attachment) : null, p.likes||0,
                        p.createdAt||new Date().toISOString());
        }
    }

    if (!db.prepare('SELECT id FROM notifications LIMIT 1').get()) {
        const f = path.join(dataDir, 'notifications.json');
        if (fs.existsSync(f)) {
            for (const n of JSON.parse(fs.readFileSync(f, 'utf8')))
                db.prepare('INSERT OR IGNORE INTO notifications(id,user_id,text,link,read,created_at) VALUES(?,?,?,?,?,?)').run(
                    n._id, n.userId, n.text, n.link||'', n.read?1:0, n.createdAt||new Date().toISOString());
        }
    }
}

module.exports = { query, uuidv4, init };
