const Datastore = require('@seald-io/nedb');
const bcrypt = require('bcryptjs');
const fs = require('fs');

if (!fs.existsSync('./data')) fs.mkdirSync('./data');

const users = new Datastore({ filename: './data/users.db', autoload: true });

users.remove({ username: 'admin' }, { multi: true }, (err) => {
    const hash = bcrypt.hashSync('admin123', 10);
    users.insert({
        username: 'admin',
        email: 'admin@forum.ru',
        password: hash,
        avatar: '/img/default_avatar.png',
        role: 'admin',
        rank: 'Администратор',
        postsCount: 0,
        reputation: 0,
        signature: '',
        banned: false,
        createdAt: new Date()
    }, (err, doc) => {
        if (err) console.log('Ошибка:', err);
        else console.log('Admin создан! Логин: admin, Пароль: admin123');
        process.exit(0);
    });
});
