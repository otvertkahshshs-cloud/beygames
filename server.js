const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./db');

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

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/forum', require('./routes/forum'));
app.use('/user', require('./routes/user'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => res.status(404).render('404'));

const PORT = 3000;
app.listen(PORT, () => console.log(`Forum: http://localhost:${PORT}`));
