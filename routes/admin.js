const express = require('express');
const router = express.Router();
const { query } = require('../db');

function admin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('404');
    next();
}

router.get('/', admin, async (req, res) => {
    const statsQ = await query('SELECT (SELECT COUNT(*) FROM users) as users,(SELECT COUNT(*) FROM threads) as threads,(SELECT COUNT(*) FROM posts) as posts');
    const stats = { users: parseInt(statsQ[0].users), threads: parseInt(statsQ[0].threads), posts: parseInt(statsQ[0].posts) };
    const users = await query('SELECT * FROM users ORDER BY created_at DESC');
    const pending = await query(`SELECT t.*, u.username, s.name as section_name FROM threads t JOIN users u ON t.user_id=u.id JOIN sections s ON t.section_id=s.id WHERE t.status='pending' ORDER BY t.created_at DESC`);
    const allThreads = await query(`SELECT t.*, u.username, s.name as section_name FROM threads t JOIN users u ON t.user_id=u.id JOIN sections s ON t.section_id=s.id WHERE t.status='approved' ORDER BY t.created_at DESC LIMIT 30`);
    for (const t of [...pending, ...allThreads]) t._id = t.id;
    for (const u of users) u._id = u.id;
    res.render('admin/index', { stats, users, pending, allThreads, user: req.session.user });
});

router.post('/approve-thread/:id', admin, async (req, res) => {
    await query("UPDATE threads SET status='approved' WHERE id=$1", [req.params.id]);
    res.redirect('/admin');
});

router.post('/reject-thread/:id', admin, async (req, res) => {
    const t = await query('SELECT * FROM threads WHERE id=$1', [req.params.id]);
    if (t.length) {
        await query('DELETE FROM posts WHERE thread_id=$1', [req.params.id]);
        await query('DELETE FROM threads WHERE id=$1', [req.params.id]);
        await query('UPDATE sections SET threads_count=threads_count-1 WHERE id=$1', [t[0].section_id]);
    }
    res.redirect('/admin');
});

router.post('/delete-thread/:id', admin, async (req, res) => {
    const t = await query('SELECT * FROM threads WHERE id=$1', [req.params.id]);
    if (t.length) {
        await query('DELETE FROM likes WHERE post_id IN (SELECT id FROM posts WHERE thread_id=$1)', [req.params.id]);
        await query('DELETE FROM posts WHERE thread_id=$1', [req.params.id]);
        await query('DELETE FROM threads WHERE id=$1', [req.params.id]);
        await query('UPDATE sections SET threads_count=threads_count-1 WHERE id=$1', [t[0].section_id]);
    }
    res.redirect('/admin');
});

router.post('/ban/:id', admin, async (req, res) => {
    await query('UPDATE users SET banned=1 WHERE id=$1', [req.params.id]);
    res.redirect('/admin');
});

router.post('/unban/:id', admin, async (req, res) => {
    await query('UPDATE users SET banned=0 WHERE id=$1', [req.params.id]);
    res.redirect('/admin');
});

router.post('/set-role/:id', admin, async (req, res) => {
    const { role } = req.body;
    if (['user','moderator','admin','benefactor'].includes(role))
        await query('UPDATE users SET role=$1 WHERE id=$2', [role, req.params.id]);
    res.redirect('/admin');
});

module.exports = router;
