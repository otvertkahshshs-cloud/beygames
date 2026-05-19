const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
    try {
        const cats = db.find('cats').sort((a,b) => a.sort - b.sort);
        for (const cat of cats) {
            cat.sections = db.find('sections', { catId: cat._id }).sort((a,b) => a.sort - b.sort);
            for (const sec of cat.sections) {
                const threads = db.find('threads', { sectionId: sec._id }).sort((a,b) => new Date(b.lastPostAt) - new Date(a.lastPostAt));
                sec.lastThread = threads[0] || null;
            }
        }
        const stats = {
            users:   db.count('users'),
            threads: db.count('threads'),
            posts:   db.count('posts'),
        };
        const latest = db.find('threads').sort((a,b) => new Date(b.lastPostAt) - new Date(a.lastPostAt)).slice(0,10);
        for (const t of latest) {
            const u = db.findOne('users', { _id: t.userId });
            const s = db.findOne('sections', { _id: t.sectionId });
            t.username = u ? u.username : '?';
            t.avatar = u ? u.avatar : '/img/default_avatar.png';
            t.sectionName = s ? s.name : '?';
        }
        res.render('index', { categories: cats, stats, latest_threads: latest });
    } catch(e) { console.error(e); res.status(500).send('Ошибка: ' + e.message); }
});

module.exports = router;
