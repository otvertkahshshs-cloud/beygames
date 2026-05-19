const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sendVerificationCode } = require('../mailer');

router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('auth/login', { error: null });
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.findOne('users', { username });
    if (!user || !bcrypt.compareSync(password, user.password))
        return res.render('auth/login', { error: 'Неверный логин или пароль' });
    if (user.banned)
        return res.render('auth/login', { error: 'Аккаунт заблокирован' });
    req.session.user = { id: user._id, username: user.username, role: user.role, avatar: user.avatar, rank: user.rank };
    res.redirect('/');
});

// Шаг 1 — форма регистрации
router.get('/register', (req, res) => {
    if (req.session.user) return res.redirect('/');
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    req.session.captcha = a + b;
    res.render('auth/register', { error: null, captchaQ: `${a} + ${b}` });
});

router.post('/register', async (req, res) => {
    const { username, email, password, password2, captcha } = req.body;

    const newCaptcha = () => {
        const a = Math.floor(Math.random() * 10) + 1;
        const b = Math.floor(Math.random() * 10) + 1;
        req.session.captcha = a + b;
        return `${a} + ${b}`;
    };

    if (parseInt(captcha) !== req.session.captcha)
        return res.render('auth/register', { error: 'Неверная капча', captchaQ: newCaptcha() });
    if (!username || !email || !password)
        return res.render('auth/register', { error: 'Заполните все поля', captchaQ: newCaptcha() });
    if (password !== password2)
        return res.render('auth/register', { error: 'Пароли не совпадают', captchaQ: newCaptcha() });
    if (username.length < 3 || username.length > 20)
        return res.render('auth/register', { error: 'Имя: 3-20 символов', captchaQ: newCaptcha() });
    if (password.length < 6)
        return res.render('auth/register', { error: 'Пароль минимум 6 символов', captchaQ: newCaptcha() });

    // Проверка формата email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
        return res.render('auth/register', { error: 'Введите корректный email (например: user@gmail.com)', captchaQ: newCaptcha() });

    const allUsers = db.find('users');
    if (allUsers.find(u => u.username === username))
        return res.render('auth/register', { error: 'Такой логин уже занят', captchaQ: newCaptcha() });
    if (allUsers.find(u => u.email === email))
        return res.render('auth/register', { error: 'Этот email уже зарегистрирован', captchaQ: newCaptcha() });

    const hash = bcrypt.hashSync(password, 10);
    const user = db.insert('users', {
        username, email, password: hash,
        avatar: '/img/default_avatar.png', role: 'user', rank: 'Новичок',
        postsCount: 0, reputation: 0, signature: '', banned: false,
        createdAt: new Date().toISOString()
    });
    req.session.user = { id: user._id, username: user.username, role: user.role, avatar: user.avatar, rank: user.rank };
    res.redirect('/');
});

// Шаг 2 — ввод кода
router.get('/verify', (req, res) => {
    if (!req.session.pendingUser) return res.redirect('/auth/register');
    res.render('auth/verify', { error: null, email: req.session.pendingUser.email });
});

router.post('/verify', (req, res) => {
    const { code } = req.body;
    const pending = req.session.pendingUser;

    if (!pending) return res.redirect('/auth/register');
    if (Date.now() > pending.expires) {
        delete req.session.pendingUser;
        return res.redirect('/auth/register');
    }
    if (code !== pending.code)
        return res.render('auth/verify', { error: 'Неверный код. Попробуйте ещё раз', email: pending.email });

    const hash = bcrypt.hashSync(pending.password, 10);
    const user = db.insert('users', {
        username: pending.username, email: pending.email, password: hash,
        avatar: '/img/default_avatar.png', role: 'user', rank: 'Новичок',
        postsCount: 0, reputation: 0, signature: '', banned: false,
        createdAt: new Date().toISOString()
    });

    delete req.session.pendingUser;
    req.session.user = { id: user._id, username: user.username, role: user.role, avatar: user.avatar, rank: user.rank };
    res.redirect('/');
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

module.exports = router;
