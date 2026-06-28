const express = require('express');
const router = express.Router();
const { query, uuidv4 } = require('../db');

function auth(req, res, next) {
    if (!req.session.user) return res.redirect('/auth/login');
    next();
}
function isAdmin(u) { return u && u.role === 'admin'; }

// List: user sees own, admin sees all
router.get('/', auth, async (req, res) => {
    const u = req.session.user;
    const tickets = isAdmin(u)
        ? await query('SELECT * FROM tickets ORDER BY created_at DESC')
        : await query('SELECT * FROM tickets WHERE user_id=$1 ORDER BY created_at DESC', [u.id]);
    res.render('tickets/list', { tickets });
});

// Create form
router.get('/new', auth, (req, res) => res.render('tickets/create', { error: null }));

router.post('/new', auth, async (req, res) => {
    const { subject, message } = req.body;
    if (!subject || !message) return res.render('tickets/create', { error: 'Заполните все поля' });
    const u = req.session.user;
    const tid = uuidv4();
    await query('INSERT INTO tickets(id,user_id,username,subject) VALUES($1,$2,$3,$4)', [tid, u.id, u.username, subject.trim().substring(0, 100)]);
    await query('INSERT INTO ticket_replies(id,ticket_id,user_id,username,message) VALUES($1,$2,$3,$4,$5)', [uuidv4(), tid, u.id, u.username, message.trim()]);
    res.redirect('/tickets/' + tid);
});

// View ticket
router.get('/:id', auth, async (req, res) => {
    const u = req.session.user;
    const rows = await query('SELECT * FROM tickets WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).render('404');
    const ticket = rows[0];
    if (!isAdmin(u) && ticket.user_id !== u.id) return res.status(403).render('404');
    const replies = await query('SELECT * FROM ticket_replies WHERE ticket_id=$1 ORDER BY created_at ASC', [req.params.id]);
    res.render('tickets/view', { ticket, replies });
});

// Reply
router.post('/:id/reply', auth, async (req, res) => {
    const u = req.session.user;
    const rows = await query('SELECT * FROM tickets WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).render('404');
    const ticket = rows[0];
    if (!isAdmin(u) && ticket.user_id !== u.id) return res.status(403).render('404');
    const { message } = req.body;
    if (message && message.trim()) {
        await query('INSERT INTO ticket_replies(id,ticket_id,user_id,username,message) VALUES($1,$2,$3,$4,$5)',
            [uuidv4(), req.params.id, u.id, u.username, message.trim()]);
    }
    res.redirect('/tickets/' + req.params.id);
});

// Close (admin only)
router.post('/:id/close', auth, async (req, res) => {
    if (!isAdmin(req.session.user)) return res.status(403).render('404');
    await query("UPDATE tickets SET status='closed' WHERE id=$1", [req.params.id]);
    res.redirect('/tickets/' + req.params.id);
});

module.exports = router;
