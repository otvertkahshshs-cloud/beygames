const express = require('express');
const router = express.Router();
const { query, uuidv4 } = require('../db');
const { getRank } = require('../utils');
const { uploadThreadFields } = require('../cloudinary');

function auth(req, res, next) {
    if (!req.session.user) return res.redirect('/auth/login');
    next();
}

router.get('/section/:id', async (req, res) => {
    try {
        const rows = await query('SELECT s.*, c.name as cat_name FROM sections s JOIN cats c ON s.cat_id=c.id WHERE s.id=$1', [req.params.id]);
        if (!rows.length) return res.status(404).render('404');
        const section = rows[0]; section._id = section.id;
        const page = parseInt(req.query.page)||1, perPage = 20;
        const total = parseInt((await query('SELECT COUNT(*) as count FROM threads WHERE section_id=$1 AND status=$2', [req.params.id,'approved']))[0].count);
        const threads = await query(`
            SELECT t.*, u.username, u.avatar, u.rank FROM threads t JOIN users u ON t.user_id=u.id
            WHERE t.section_id=$1 AND t.status='approved'
            ORDER BY t.pinned DESC, t.last_post_at DESC LIMIT $2 OFFSET $3
        `, [req.params.id, perPage, (page-1)*perPage]);
        for (const t of threads) t._id = t.id;
        res.render('forum/section', { section, threads, page, totalPages: Math.ceil(total/perPage) });
    } catch(e) { console.error(e); res.status(500).send('Ошибка: '+e.message); }
});

router.get('/thread/:id', async (req, res) => {
    try {
        const rows = await query(`
            SELECT t.*, u.username, u.avatar, s.name as section_name, s.id as section_id
            FROM threads t JOIN users u ON t.user_id=u.id JOIN sections s ON t.section_id=s.id WHERE t.id=$1
        `, [req.params.id]);
        if (!rows.length) return res.status(404).render('404');
        const thread = rows[0]; thread._id = thread.id;
        await query('UPDATE threads SET views=views+1 WHERE id=$1', [req.params.id]);
        const page = parseInt(req.query.page)||1, perPage = 15;
        const total = parseInt((await query('SELECT COUNT(*) as count FROM posts WHERE thread_id=$1', [req.params.id]))[0].count);
        const posts = await query(`
            SELECT p.*, u.username, u.avatar, u.role, u.posts_count, u.reputation, u.signature, u.created_at as reg_date
            FROM posts p JOIN users u ON p.user_id=u.id WHERE p.thread_id=$1 ORDER BY p.created_at LIMIT $2 OFFSET $3
        `, [req.params.id, perPage, (page-1)*perPage]);
        for (const p of posts) {
            p._id = p.id;
            const r = getRank({ role: p.role, postsCount: p.posts_count });
            p.rank = r.name; p.rankCss = r.css;
            if (p.attachment && typeof p.attachment === 'string') {
                try { p.attachment = JSON.parse(p.attachment); } catch { p.attachment = null; }
            }
        }
        const likedPosts = new Set();
        if (req.session.user) {
            const likes = await query('SELECT post_id FROM likes WHERE user_id=$1', [req.session.user.id]);
            likes.forEach(l => likedPosts.add(l.post_id));
        }
        res.render('forum/thread', { thread, posts, page, totalPages: Math.ceil(total/perPage), likedPosts });
    } catch(e) { console.error(e); res.status(500).send('Ошибка: '+e.message); }
});

router.get('/section/:id/new', auth, async (req, res) => {
    const rows = await query('SELECT * FROM sections WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).render('404');
    const section = rows[0]; section._id = section.id;
    res.render('forum/new_thread', { section, error: null });
});

router.post('/section/:id/new', auth, uploadThreadFields, async (req, res) => {
    try {
        const { title, content } = req.body;
        const rows = await query('SELECT * FROM sections WHERE id=$1', [req.params.id]);
        if (!rows.length) return res.status(404).render('404');
        const section = rows[0]; section._id = section.id;
        if (!title||!content||title.trim().length<1||content.trim().length<1)
            return res.render('forum/new_thread', { section, error: 'Заполните заголовок и текст' });

        const user = req.session.user;
        const rawFile  = req.files && req.files['file']  ? req.files['file'][0]  : null;
        const rawImage = req.files && req.files['image'] ? req.files['image'][0] : null;

        // Файлы уже сохранены на диск multer-ом, берём локальный URL
        const finalImage = rawImage ? '/uploads/threads/' + rawImage.filename : null;

        let attachment = null;
        if (rawFile) {
            const ext = rawFile.originalname.split('.').pop().toLowerCase();
            attachment = {
                filename: rawFile.originalname,
                path: '/uploads/files/' + rawFile.filename,
                size: rawFile.size,
                ext,
            };
        }

        const tid = uuidv4();
        await query('INSERT INTO threads(id,section_id,user_id,title,status,last_post_user) VALUES($1,$2,$3,$4,$5,$6)',
            [tid, req.params.id, user.id, title.trim(), 'pending', user.username]);
        await query('INSERT INTO posts(id,thread_id,user_id,content,image,attachment) VALUES($1,$2,$3,$4,$5,$6)',
            [uuidv4(), tid, user.id, content.trim(), finalImage, attachment ? JSON.stringify(attachment) : null]);
        await query('UPDATE users SET posts_count=posts_count+1 WHERE id=$1', [user.id]);
        await query('UPDATE sections SET threads_count=threads_count+1, posts_count=posts_count+1 WHERE id=$1', [req.params.id]);
        res.render('forum/pending', { section });
    } catch(e) { console.error(e); res.status(500).send('Ошибка: '+e.message); }
});

router.post('/thread/:id/reply', auth, uploadThreadFields, async (req, res) => {
    try {
        const { content } = req.body;
        if (!content||content.trim().length<1) return res.redirect('/forum/thread/'+req.params.id);
        const rows = await query('SELECT * FROM threads WHERE id=$1', [req.params.id]);
        if (!rows.length||rows[0].locked) return res.redirect('/forum/thread/'+req.params.id);
        const thread = rows[0];
        const user = req.session.user;

        // Файлы уже сохранены на диск multer-ом, берём локальный URL
        let attachment = null;
        const rawFile = req.files && req.files['file'] ? req.files['file'][0] : null;
        if (rawFile) {
            const ext = rawFile.originalname.split('.').pop().toLowerCase();
            attachment = {
                filename: rawFile.originalname,
                path: '/uploads/files/' + rawFile.filename,
                size: rawFile.size,
                ext,
            };
        }

        await query('INSERT INTO posts(id,thread_id,user_id,content,attachment) VALUES($1,$2,$3,$4,$5)',
            [uuidv4(), req.params.id, user.id, content.trim(), attachment ? JSON.stringify(attachment) : null]);
        await query('UPDATE threads SET replies=replies+1, last_post_at=NOW(), last_post_user=$1 WHERE id=$2', [user.username, req.params.id]);
        await query('UPDATE users SET posts_count=posts_count+1 WHERE id=$1', [user.id]);
        await query('UPDATE sections SET posts_count=posts_count+1 WHERE id=$1', [thread.section_id]);
        if (thread.user_id !== user.id)
            await query('INSERT INTO notifications(id,user_id,text,link) VALUES($1,$2,$3,$4)',
                [uuidv4(), thread.user_id, `<b>${user.username}</b> ответил в вашей теме «${thread.title.substring(0,40)}»`, `/forum/thread/${req.params.id}`]);
        const total = parseInt((await query('SELECT COUNT(*) as count FROM posts WHERE thread_id=$1', [req.params.id]))[0].count);
        res.redirect('/forum/thread/'+req.params.id+'?page='+Math.ceil(total/15)+'#bottom');
    } catch(e) { console.error(e); res.status(500).send('Ошибка: '+e.message); }
});

router.post('/post/:id/like', auth, async (req, res) => {
    try {
        const postId = req.params.id, userId = req.session.user.id;
        const exists = await query('SELECT 1 FROM likes WHERE user_id=$1 AND post_id=$2', [userId, postId]);
        if (exists.length) {
            await query('DELETE FROM likes WHERE user_id=$1 AND post_id=$2', [userId, postId]);
            await query('UPDATE posts SET likes=likes-1 WHERE id=$1', [postId]);
        } else {
            await query('INSERT INTO likes(user_id,post_id) VALUES($1,$2)', [userId, postId]);
            await query('UPDATE posts SET likes=likes+1 WHERE id=$1', [postId]);
            const post = await query('SELECT user_id FROM posts WHERE id=$1', [postId]);
            if (post.length && post[0].user_id !== userId)
                await query('UPDATE users SET reputation=reputation+1 WHERE id=$1', [post[0].user_id]);
        }
        res.json({ ok: true });
    } catch(e) { res.json({ ok: false }); }
});

module.exports = router;
