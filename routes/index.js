const express = require('express');
const router = express.Router();
const { query } = require('../db');

router.get('/', async (req, res) => {
    try {
        const cats = await query('SELECT * FROM cats ORDER BY sort');
        for (const cat of cats) {
            cat.sections = await query('SELECT * FROM sections WHERE cat_id=$1 ORDER BY sort', [cat.id]);
            for (const sec of cat.sections) {
                const last = await query('SELECT * FROM threads WHERE section_id=$1 AND status=$2 ORDER BY last_post_at DESC LIMIT 1', [sec.id, 'approved']);
                sec.lastThread = last[0] || null;
                sec._id = sec.id;
            }
            cat._id = cat.id;
        }
        const statsQ = await query('SELECT (SELECT COUNT(*) FROM users) as users, (SELECT COUNT(*) FROM threads) as threads, (SELECT COUNT(*) FROM posts) as posts');
        const stats = { users: parseInt(statsQ[0].users), threads: parseInt(statsQ[0].threads), posts: parseInt(statsQ[0].posts) };
        const latest = await query(`
            SELECT t.*, u.username, u.avatar, s.name as section_name
            FROM threads t JOIN users u ON t.user_id=u.id JOIN sections s ON t.section_id=s.id
            WHERE t.status='approved' ORDER BY t.last_post_at DESC LIMIT 10
        `);
        for (const t of latest) { t._id = t.id; t.sectionName = t.section_name; }
        const onlineUsers = Array.from(req.app.locals.onlineMap.values());
        res.render('index', { categories: cats, stats, latest_threads: latest, onlineUsers });
    } catch(e) { console.error(e); res.status(500).send('Ошибка: ' + e.message); }
});

module.exports = router;
