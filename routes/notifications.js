const express = require('express');
const router = express.Router();
const { query } = require('../db');

function auth(req, res, next) {
    if (!req.session.user) return res.redirect('/auth/login');
    next();
}

router.get('/', auth, async (req, res) => {
    const notifs = await query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30', [req.session.user.id]);
    await query('UPDATE notifications SET read=1 WHERE user_id=$1', [req.session.user.id]);
    res.render('notifications', { notifs });
});

module.exports = router;
