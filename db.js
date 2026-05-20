const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

if (!fs.existsSync('./data')) fs.mkdirSync('./data');

function loadDB(name) {
    const file = `./data/${name}.json`;
    if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveDB(name, data) {
    fs.writeFileSync(`./data/${name}.json`, JSON.stringify(data, null, 2));
}

const db = {
    find: (name, query = {}) => {
        const data = loadDB(name);
        return data.filter(item => Object.keys(query).every(k => item[k] === query[k]));
    },
    findOne: (name, query = {}) => {
        const data = loadDB(name);
        return data.find(item => Object.keys(query).every(k => item[k] === query[k])) || null;
    },
    insert: (name, doc) => {
        const data = loadDB(name);
        const newDoc = { _id: uuidv4(), ...doc };
        data.push(newDoc);
        saveDB(name, data);
        return newDoc;
    },
    update: (name, query, changes) => {
        const data = loadDB(name);
        let count = 0;
        const updated = data.map(item => {
            if (Object.keys(query).every(k => item[k] === query[k])) {
                count++;
                const newItem = { ...item };
                if (changes.$set) Object.assign(newItem, changes.$set);
                if (changes.$inc) Object.keys(changes.$inc).forEach(k => { newItem[k] = (newItem[k] || 0) + changes.$inc[k]; });
                return newItem;
            }
            return item;
        });
        saveDB(name, updated);
        return count;
    },
    remove: (name, query) => {
        const data = loadDB(name);
        const filtered = data.filter(item => !Object.keys(query).every(k => item[k] === query[k]));
        saveDB(name, filtered);
        return data.length - filtered.length;
    },
    count: (name, query = {}) => {
        return db.find(name, query).length;
    }
};

// Seed
function seed() {
    if (db.count('cats') > 0) return;

    const cat1 = db.insert('cats', { name: 'Читы и Хаки', description: 'Всё для игровых читов', icon: '<i class="fa-solid fa-crosshairs"></i>', sort: 1 });
    const cat2 = db.insert('cats', { name: 'Игры',        description: 'Обсуждение игр',        icon: '<i class="fa-solid fa-gamepad"></i>', sort: 2 });
    const cat3 = db.insert('cats', { name: 'Маркет',      description: 'Купля и продажа',       icon: '<i class="fa-solid fa-tag"></i>', sort: 3 });
    const cat4 = db.insert('cats', { name: 'Общение',     description: 'Флуд и общение',        icon: '<i class="fa-solid fa-comments"></i>', sort: 4 });

    db.insert('sections', { catId: cat1._id, name: 'CS2',         desc: 'Читы для CS2',      icon: '<i class="fa-solid fa-gun"></i>', sort: 1, threadsCount: 0, postsCount: 0 });
    db.insert('sections', { catId: cat1._id, name: 'Valorant',    desc: 'Читы для Valorant', icon: '<i class="fa-solid fa-bolt"></i>', sort: 2, threadsCount: 0, postsCount: 0 });
    db.insert('sections', { catId: cat1._id, name: 'Rust',        desc: 'Читы для Rust',     icon: '<i class="fa-solid fa-axe"></i>', sort: 3, threadsCount: 0, postsCount: 0 });
    db.insert('sections', { catId: cat2._id, name: 'CS2',         desc: 'Обсуждение CS2',    icon: '<i class="fa-solid fa-gun"></i>', sort: 1, threadsCount: 0, postsCount: 0 });
    db.insert('sections', { catId: cat2._id, name: 'Другие игры', desc: 'Прочие игры',       icon: '<i class="fa-solid fa-dice"></i>', sort: 2, threadsCount: 0, postsCount: 0 });
    db.insert('sections', { catId: cat3._id, name: 'Аккаунты',    desc: 'Продажа аккаунтов', icon: '<i class="fa-solid fa-user"></i>', sort: 1, threadsCount: 0, postsCount: 0 });
    db.insert('sections', { catId: cat3._id, name: 'Услуги',      desc: 'Игровые услуги',    icon: '<i class="fa-solid fa-wrench"></i>', sort: 2, threadsCount: 0, postsCount: 0 });
    db.insert('sections', { catId: cat4._id, name: 'Флудилка',    desc: 'Общение обо всём',  icon: '<i class="fa-solid fa-fire"></i>', sort: 1, threadsCount: 0, postsCount: 0 });
    db.insert('sections', { catId: cat4._id, name: 'Знакомства',  desc: 'Найди друзей',      icon: '<i class="fa-solid fa-handshake"></i>', sort: 2, threadsCount: 0, postsCount: 0 });

    const hash = bcrypt.hashSync('admin123', 10);
    db.insert('users', {
        username: 'admin', email: 'admin@forum.ru', password: hash,
        avatar: '/img/default_avatar.png', role: 'admin', rank: 'Администратор',
        postsCount: 0, reputation: 0, signature: '', banned: false,
        createdAt: new Date().toISOString()
    });

    console.log('База создана. Логин: admin / Пароль: admin123');
}

seed();

module.exports = db;
