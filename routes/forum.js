const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

if (!fs.existsSync('./public/uploads/threads')) fs.mkdirSync('./public/uploads/threads', { recursive: true });

const storage = multer.diskStorage({
    destination: './public/uploads/threads/',
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

function auth(req, res, next) {
    if (!req.session.user) return res.redirect('/auth/login');
    next();
}

router.get('/section/:id', (req, res) => {
    try {
        const section = db.findOne('sections', { _id: req.params.id });
        if (!section) return res.status(404).render('404');
        const cat = db.findOne('cats', { _id: section.catId });
        section.cat_name = cat ? cat.name : '';

        const page = parseInt(req.query.page) || 1;
        const perPage = 20;
        let threads = db.find('threads', { sectionId: req.params.id })
            .filter(t => t.status === 'approved' || !t.status)
            .sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0) || new Date(b.lastPostAt)-new Date(a.lastPostAt));
        const total = threads.length;
        threads = threads.slice((page-1)*perPage, page*perPage);
        for (const t of threads) {
            const u = db.findOne('users', { _id: t.userId });
            t.username = u ? u.username : '?';
            t.avatar = u ? u.avatar : '/img/default_avatar.png';
            t.rank = u ? u.rank : '';
        }
        res.render('forum/section', { section, threads, page, totalPages: Math.ceil(total/perPage) });
    } catch(e) { console.error(e); res.status(500).send('Ошибка: '+e.message); }
});

router.get('/thread/:id', (req, res) => {
    try {
        const thread = db.findOne('threads', { _id: req.params.id });
        if (!thread) return res.status(404).render('404');

        db.update('threads', { _id: req.params.id }, { $inc: { views: 1 } });

        const author = db.findOne('users', { _id: thread.userId });
        const section = db.findOne('sections', { _id: thread.sectionId });
        thread.username = author ? author.username : '?';
        thread.avatar = author ? author.avatar : '/img/default_avatar.png';
        thread.section_name = section ? section.name : '?';
        thread.section_id = thread.sectionId;

        const page = parseInt(req.query.page) || 1;
        const perPage = 15;
        let posts = db.find('threads', {}).filter(() => true);
        posts = db.find('posts', { threadId: req.params.id })
            .sort((a,b) => new Date(a.createdAt)-new Date(b.createdAt));
        const total = posts.length;
        posts = posts.slice((page-1)*perPage, page*perPage);
        for (const p of posts) {
            const u = db.findOne('users', { _id: p.userId });
            p.username = u ? u.username : '?';
            p.avatar = u ? u.avatar : '/img/default_avatar.png';
            p.rank = u ? u.rank : '';
            p.posts_count = u ? u.postsCount : 0;
            p.reputation = u ? u.reputation : 0;
            p.signature = u ? u.signature : '';
            p.reg_date = u ? u.createdAt : new Date().toISOString();
        }

        const likedPosts = new Set();
        if (req.session.user) {
            db.find('likes', { userId: req.session.user.id }).forEach(l => likedPosts.add(l.postId));
        }

        res.render('forum/thread', { thread, posts, page, totalPages: Math.ceil(total/perPage), likedPosts });
    } catch(e) { console.error(e); res.status(500).send('Ошибка: '+e.message); }
});

router.get('/section/:id/new', auth, (req, res) => {
    const section = db.findOne('sections', { _id: req.params.id });
    if (!section) return res.status(404).render('404');
    res.render('forum/new_thread', { section, error: null });
});

router.post('/section/:id/new', auth, upload.fields([{ name: 'file', maxCount: 1 }, { name: 'image', maxCount: 1 }]), (req, res) => {
    try {
        const { title, content } = req.body;
        const section = db.findOne('sections', { _id: req.params.id });
        if (!section) return res.status(404).render('404');
        if (!title || !content || title.trim().length < 1 || content.trim().length < 1)
            return res.render('forum/new_thread', { section, error: 'Заполните заголовок и текст' });

        const user = req.session.user;
        const now = new Date().toISOString();
        const imagePath = null;
        let attachment = null;
        const uploadedFile = (req.files && req.files['file']) ? req.files['file'][0] : null;
        const uploadedImage = (req.files && req.files['image']) ? req.files['image'][0] : null;

        if (uploadedFile) {
            attachment = {
                filename: uploadedFile.originalname,
                path: '/uploads/threads/' + uploadedFile.filename,
                size: uploadedFile.size,
                ext: uploadedFile.originalname.split('.').pop().toLowerCase()
            };
        }
        const finalImage = uploadedImage ? '/uploads/threads/' + uploadedImage.filename : null;

        const thread = db.insert('threads', {
            sectionId: req.params.id, userId: user.id,
            title: title.trim(), views: 0, replies: 0,
            pinned: false, locked: false, status: 'pending',
            createdAt: now, lastPostAt: now, lastPostUser: user.username
        });
        db.insert('posts', { threadId: thread._id, userId: user.id, content: content.trim(), image: finalImage, attachment, likes: 0, createdAt: now });
        db.update('users', { _id: user.id }, { $inc: { postsCount: 1 } });
        db.update('sections', { _id: req.params.id }, { $inc: { threadsCount: 1, postsCount: 1 } });
        res.render('forum/pending', { section });
    } catch(e) { console.error(e); res.status(500).send('Ошибка: '+e.message); }
});

router.post('/thread/:id/reply', auth, upload.single('file'), (req, res) => {
    try {
        const { content } = req.body;
        if (!content || content.trim().length < 1) return res.redirect('/forum/thread/' + req.params.id);
        const thread = db.findOne('threads', { _id: req.params.id });
        if (!thread || thread.locked) return res.redirect('/forum/thread/' + req.params.id);

        const user = req.session.user;
        const now = new Date().toISOString();

        let attachment = null;
        if (req.file) {
            attachment = {
                filename: req.file.originalname,
                path: '/uploads/threads/' + req.file.filename,
                size: req.file.size,
                ext: req.file.originalname.split('.').pop().toLowerCase()
            };
        }

        db.insert('posts', { threadId: req.params.id, userId: user.id, content: content.trim(), image: null, attachment, likes: 0, createdAt: now });
        db.update('threads', { _id: req.params.id }, { $inc: { replies: 1 }, $set: { lastPostAt: now, lastPostUser: user.username } });
        db.update('users', { _id: user.id }, { $inc: { postsCount: 1 } });
        db.update('sections', { _id: thread.sectionId }, { $inc: { postsCount: 1 } });

        const total = db.count('posts', { threadId: req.params.id });
        const lastPage = Math.ceil(total / 15);
        res.redirect('/forum/thread/' + req.params.id + '?page=' + lastPage + '#bottom');
    } catch(e) { console.error(e); res.status(500).send('Ошибка: '+e.message); }
});

router.post('/post/:id/like', auth, (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.session.user.id;
        const exists = db.findOne('likes', { userId, postId });
        if (exists) {
            db.remove('likes', { userId, postId });
            db.update('posts', { _id: postId }, { $inc: { likes: -1 } });
        } else {
            db.insert('likes', { userId, postId });
            db.update('posts', { _id: postId }, { $inc: { likes: 1 } });
            const post = db.findOne('posts', { _id: postId });
            if (post && post.userId !== userId)
                db.update('users', { _id: post.userId }, { $inc: { reputation: 1 } });
        }
        res.json({ ok: true });
    } catch(e) { res.json({ ok: false }); }
});

module.exports = router;
