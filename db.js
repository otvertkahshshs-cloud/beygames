const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function query(sql, params = []) {
    const client = await pool.connect();
    try {
        const res = await client.query(sql, params);
        return res.rows;
    } finally {
        client.release();
    }
}

async function init() {
    await query(`
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
            banned BOOLEAN DEFAULT false,
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
            desc TEXT DEFAULT '',
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
            pinned BOOLEAN DEFAULT false,
            locked BOOLEAN DEFAULT false,
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
            attachment JSONB,
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
            read BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);

    // Seed
    const cats = await query('SELECT id FROM cats LIMIT 1');
    if (cats.length > 0) return;

    const c1 = uuidv4(), c2 = uuidv4(), c3 = uuidv4(), c4 = uuidv4();
    await query(`INSERT INTO cats VALUES
        ($1,'Читы и Хаки','Всё для игровых читов','<i class="fa-solid fa-crosshairs"></i>',1),
        ($2,'Игры','Обсуждение игр','<i class="fa-solid fa-gamepad"></i>',2),
        ($3,'Маркет','Купля и продажа','<i class="fa-solid fa-tag"></i>',3),
        ($4,'Общение','Флуд и общение','<i class="fa-solid fa-comments"></i>',4)
    `, [c1, c2, c3, c4]);

    const secs = [
        [uuidv4(), c1, 'CS2', 'Читы для CS2', '<i class="fa-solid fa-gun"></i>', 1],
        [uuidv4(), c1, 'Valorant', 'Читы для Valorant', '<i class="fa-solid fa-bolt"></i>', 2],
        [uuidv4(), c1, 'Rust', 'Читы для Rust', '<i class="fa-solid fa-biohazard"></i>', 3],
        [uuidv4(), c2, 'CS2', 'Обсуждение CS2', '<i class="fa-solid fa-gun"></i>', 1],
        [uuidv4(), c2, 'Другие игры', 'Прочие игры', '<i class="fa-solid fa-dice"></i>', 2],
        [uuidv4(), c3, 'Аккаунты', 'Продажа аккаунтов', '<i class="fa-solid fa-user"></i>', 1],
        [uuidv4(), c3, 'Услуги', 'Игровые услуги', '<i class="fa-solid fa-wrench"></i>', 2],
        [uuidv4(), c4, 'Флудилка', 'Общение обо всём', '<i class="fa-solid fa-fire"></i>', 1],
        [uuidv4(), c4, 'Знакомства', 'Найди друзей', '<i class="fa-solid fa-handshake"></i>', 2],
    ];
    for (const s of secs)
        await query('INSERT INTO sections(id,cat_id,name,desc,icon,sort,threads_count,posts_count) VALUES($1,$2,$3,$4,$5,$6,0,0)', s);

    const hash = bcrypt.hashSync('admin123', 10);
    await query('INSERT INTO users(id,username,email,password,role,rank) VALUES($1,$2,$3,$4,$5,$6)',
        [uuidv4(), 'admin', 'admin@forum.ru', hash, 'admin', 'Администратор']);

    console.log('DB seeded. admin / admin123');
}

module.exports = { query, uuidv4, init };
