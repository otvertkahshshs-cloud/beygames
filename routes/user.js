const express = require('express');
const router = express.Router();
const { query } = require('../db');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

if (!fs.existsSync('./public/uploads')) fs.mkdirSync('./public/uploads', { recursive: true });
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => cb(null, 'avatar_' + req.session.user.id + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 2*1024*1024 } });

function auth(req, res, next) {
    if (!req.session.user) return res.redirect('/auth/login');
    next();
}

router.get('/settings/edit', auth, async (req, res) => {
    const rows = await query('SELECT * FROM users WHERE id=$1', [req.session.user.id]);
    res.render('user/settings', { user: rows[0], error: null, success: null });
});

router.post('/settings/edit', auth, upload.single('avatar'), async (req, res) => {
    const { signature, old_password, new_password } = req.body;
    const rows = await query('SELECT * FROM users WHERE id=$1', [req.session.user.id]);
    const user = rows[0];
    let avatarPath = user.avatar;
    if (req.file) avatarPath = '/uploads/' + req.file.filename;
    if (new_password) {
        if (!bcrypt.compareSync(old_password, user.password))
            return res.render('user/settings', { user, error: 'Неверный текущий пароль', success: null });
        if (new_password.length < 6)
            return res.render('user/settings', { user, error: 'Новый пароль минимум 6 символов', success: null });
        const hash = bcrypt.hashSync(new_password, 10);
        await query('UPDATE users SET password=$1 WHERE id=$2', [hash, user.id]);
    }
    await query('UPDATE users SET signature=$1, avatar=$2 WHERE id=$3', [signature||'', avatarPath, user.id]);
    req.session.user.avatar = avatarPath;
    const updated = await query('SELECT * FROM users WHERE id=$1', [user.id]);
    res.render('user/settings', { user: updated[0], error: null, success: 'Сохранено!' });
});

router.get('/:username', async (req, res) => {
    const rows = await query('SELECT * FROM users WHERE username=$1', [req.params.username]);
    if (!rows.length) return res.status(404).render('404');
    const profile = rows[0]; profile._id = profile.id;
    const threads = await query(`
        SELECT t.*, s.name as section_name FROM threads t JOIN sections s ON t.section_id=s.id
        WHERE t.user_id=$1 ORDER BY t.created_at DESC LIMIT 10
    `, [profile.id]);
    for (const t of threads) t._id = t.id;
    const posts = await query(`
        SELECT p.*, t.title as thread_title FROM posts p JOIN threads t ON p.thread_id=t.id
        WHERE p.user_id=$1 ORDER BY p.created_at DESC LIMIT 10
    `, [profile.id]);
    for (const p of posts) { p._id = p.id; p.threadId = p.thread_id; }
    res.render('user/profile', { profile, threads, posts });
});

module.exports = router;
