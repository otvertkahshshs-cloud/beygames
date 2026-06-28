const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../data/forum.db'));

router.get('/messages', (req, res) => {
    const since = req.query.since || 0;
    const rows = db.prepare('SELECT * FROM chat_messages WHERE id > ? ORDER BY id ASC LIMIT 50').all(since);
    res.json(rows);
});

router.post('/send', (req, res) => {
    if (!req.session.user) return res.json({ ok: false, error: 'not_logged_in' });
    const msg = (req.body.message || '').trim().substring(0, 300);
    if (!msg) return res.json({ ok: false });
    const u = req.session.user;
    db.prepare('INSERT INTO chat_messages(user_id,username,avatar,message) VALUES(?,?,?,?)').run(u.id, u.username, u.avatar || '/img/default_avatar.png', msg);
    // Keep only last 200 messages
    db.prepare('DELETE FROM chat_messages WHERE id NOT IN (SELECT id FROM chat_messages ORDER BY id DESC LIMIT 200)').run();
    res.json({ ok: true });
});

module.exports = router;
