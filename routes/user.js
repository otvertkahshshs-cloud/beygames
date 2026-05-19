const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

if (!fs.existsSync('./public/uploads')) fs.mkdirSync('./public/uploads', { recursive: true });

const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => cb(null, 'avatar_' + req.session.user.id + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

function auth(req, res, next) {
    if (!req.session.user) return res.redirect('/auth/login');
    next();
}

router.get('/settings/edit', auth, (req, res) => {
    const user = db.findOne('users', { _id: req.session.user.id });
    res.render('user/settings', { user, error: null, success: null });
});

router.post('/settings/edit', auth, upload.single('avatar'), (req, res) => {
    const { signature, old_password, new_password } = req.body;
    const user = db.findOne('users', { _id: req.session.user.id });
    let avatarPath = user.avatar;
    if (req.file) avatarPath = '/uploads/' + req.file.filename;

    if (new_password) {
        if (!bcrypt.compareSync(old_password, user.password))
            return res.render('user/settings', { user, error: 'Неверный текущий пароль', success: null });
        if (new_password.length < 6)
            return res.render('user/settings', { user, error: 'Новый пароль минимум 6 символов', success: null });
        const hash = bcrypt.hashSync(new_password, 10);
        db.update('users', { _id: user._id }, { $set: { password: hash } });
    }

    db.update('users', { _id: user._id }, { $set: { signature: signature || '', avatar: avatarPath } });
    req.session.user.avatar = avatarPath;
    const updated = db.findOne('users', { _id: user._id });
    res.render('user/settings', { user: updated, error: null, success: 'Сохранено!' });
});

router.get('/:username', (req, res) => {
    const profile = db.findOne('users', { username: req.params.username });
    if (!profile) return res.status(404).render('404');

    let threads = db.find('threads', { userId: profile._id })
        .sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,10);
    for (const t of threads) {
        const s = db.findOne('sections', { _id: t.sectionId });
        t.section_name = s ? s.name : '?';
    }

    let posts = db.find('posts', { userId: profile._id })
        .sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,10);
    for (const p of posts) {
        const t = db.findOne('threads', { _id: p.threadId });
        p.thread_title = t ? t.title : '?';
    }

    res.render('user/profile', { profile, threads, posts });
});

module.exports = router;
