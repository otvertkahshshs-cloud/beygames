const express = require('express');
const router = express.Router();
const db = require('../db');

function admin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('404');
    next();
}

router.get('/', admin, (req, res) => {
    const stats = {
        users:   db.count('users'),
        threads: db.count('threads'),
        posts:   db.count('posts'),
    };
    const users = db.find('users').sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
    const pending = db.find('threads', { status: 'pending' }).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
    for (const t of pending) {
        const u = db.findOne('users', { _id: t.userId });
        const s = db.findOne('sections', { _id: t.sectionId });
        t.username = u ? u.username : '?';
        t.sectionName = s ? s.name : '?';
    }
    const allThreads = db.find('threads', { status: 'approved' }).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,30);
    for (const t of allThreads) {
        const u = db.findOne('users', { _id: t.userId });
        const s = db.findOne('sections', { _id: t.sectionId });
        t.username = u ? u.username : '?';
        t.sectionName = s ? s.name : '?';
    }
    res.render('admin/index', { stats, users, pending, allThreads });
});

router.post('/set-role/:id', admin, (req, res) => {
    const { role } = req.body;
    const allowed = ['user', 'moderator', 'admin'];
    if (allowed.includes(role))
        db.update('users', { _id: req.params.id }, { $set: { role } });
    res.redirect('/admin');
});

router.post('/ban/:id', admin, (req, res) => {
    db.update('users', { _id: req.params.id }, { $set: { banned: true } });
    res.redirect('/admin');
});

router.post('/unban/:id', admin, (req, res) => {
    db.update('users', { _id: req.params.id }, { $set: { banned: false } });
    res.redirect('/admin');
});

router.post('/approve-thread/:id', admin, (req, res) => {
    db.update('threads', { _id: req.params.id }, { $set: { status: 'approved' } });
    res.redirect('/admin');
});

router.post('/reject-thread/:id', admin, (req, res) => {
    const thread = db.findOne('threads', { _id: req.params.id });
    if (thread) {
        db.remove('posts', { threadId: req.params.id });
        db.remove('threads', { _id: req.params.id });
        db.update('sections', { _id: thread.sectionId }, { $inc: { threadsCount: -1 } });
    }
    res.redirect('/admin');
});

router.post('/delete-thread/:id', admin, (req, res) => {
    const thread = db.findOne('threads', { _id: req.params.id });
    if (thread) {
        db.remove('posts', { threadId: req.params.id });
        db.remove('threads', { _id: req.params.id });
        db.update('sections', { _id: thread.sectionId }, { $inc: { threadsCount: -1 } });
    }
    res.redirect('/admin');
});

module.exports = router;
