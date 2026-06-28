const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'forum_secret_key_2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

app.use(async (req, res, next) => {
    res.locals.user = req.session.user || null;
    if (req.session.user) {
        try {
            const { query } = require('./db');
            const rows = await query('SELECT COUNT(*) as count FROM notifications WHERE user_id=$1 AND read=0', [req.session.user.id]);
            res.locals.notifCount = parseInt(rows[0].count);
        } catch(e) { res.locals.notifCount = 0; }
    } else {
        res.locals.notifCount = 0;
    }
    next();
});

app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/forum', require('./routes/forum'));
app.use('/user', require('./routes/user'));
app.use('/admin', require('./routes/admin'));
app.use('/notifications', require('./routes/notifications'));
app.use('/chat', require('./routes/chat'));
app.use('/loader', require('./routes/loader'));
app.use('/tickets', require('./routes/tickets'));

app.use((req, res) => res.status(404).render('404'));

const PORT = process.env.PORT || 3000;

const { init } = require('./db');
init().then(() => {
    app.listen(PORT, () => console.log(`Forum: http://localhost:${PORT}`));
}).catch(err => {
    console.error('DB init failed:', err);
    process.exit(1);
});
