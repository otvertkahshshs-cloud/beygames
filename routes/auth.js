const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, uuidv4 } = require('../db');

router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('auth/login', { error: null });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const rows = await query('SELECT * FROM users WHERE username=$1', [username]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password))
        return res.render('auth/login', { error: 'Неверный логин или пароль' });
    if (user.banned) return res.render('auth/login', { error: 'Аккаунт заблокирован' });
    req.session.user = { id: user.id, username: user.username, role: user.role, avatar: user.avatar, rank: user.rank };
    res.redirect('/');
});

router.get('/register', (req, res) => {
    if (req.session.user) return res.redirect('/');
    const a = Math.floor(Math.random()*10)+1, b = Math.floor(Math.random()*10)+1;
    req.session.captcha = a+b;
    res.render('auth/register', { error: null, captchaQ: `${a} + ${b}` });
});

router.post('/register', async (req, res) => {
    const { username, email, password, password2, captcha } = req.body;
    const nc = () => { const a=Math.floor(Math.random()*10)+1,b=Math.floor(Math.random()*10)+1; req.session.captcha=a+b; return `${a} + ${b}`; };
    if (parseInt(captcha) !== req.session.captcha) return res.render('auth/register', { error: 'Неверная капча', captchaQ: nc() });
    if (!username||!email||!password) return res.render('auth/register', { error: 'Заполните все поля', captchaQ: nc() });
    if (password !== password2) return res.render('auth/register', { error: 'Пароли не совпадают', captchaQ: nc() });
    if (username.length<3||username.length>20) return res.render('auth/register', { error: 'Имя: 3-20 символов', captchaQ: nc() });
    if (password.length<6) return res.render('auth/register', { error: 'Пароль минимум 6 символов', captchaQ: nc() });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.render('auth/register', { error: 'Некорректный email', captchaQ: nc() });
    const exists = await query('SELECT id FROM users WHERE username=$1 OR email=$2', [username, email]);
    if (exists.length) return res.render('auth/register', { error: 'Пользователь уже существует', captchaQ: nc() });
    const hash = bcrypt.hashSync(password, 10);
    const user = await query('INSERT INTO users(id,username,email,password) VALUES($1,$2,$3,$4) RETURNING *',
        [uuidv4(), username, email, hash]);
    req.session.user = { id: user[0].id, username: user[0].username, role: user[0].role, avatar: user[0].avatar, rank: user[0].rank };
    res.redirect('/');
});

router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

module.exports = router;
