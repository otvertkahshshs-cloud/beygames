const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const LOADER_DIR = path.join(__dirname, '../data/loader');
const META_FILE = path.join(LOADER_DIR, 'meta.json');
if (!fs.existsSync(LOADER_DIR)) fs.mkdirSync(LOADER_DIR, { recursive: true });

function getMeta() {
    if (!fs.existsSync(META_FILE)) return { version: '1.0.0', date: '—', filename: null };
    return JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
}

const storage = multer.diskStorage({
    destination: LOADER_DIR,
    filename: (req, file, cb) => cb(null, 'loader' + path.extname(file.originalname))
});
const upload = multer({ storage });

router.get('/', (req, res) => {
    const meta = getMeta();
    res.render('loader', {
        loaderVersion: meta.version,
        loaderDate: meta.date,
        loaderFile: meta.filename ? path.join(LOADER_DIR, meta.filename) : null,
        user: req.session.user || null
    });
});

router.get('/download', (req, res) => {
    const meta = getMeta();
    if (!meta.filename) return res.status(404).send('Файл не найден');
    const file = path.join(LOADER_DIR, meta.filename);
    if (!fs.existsSync(file)) return res.status(404).send('Файл не найден');
    res.download(file, meta.filename);
});

router.post('/upload', upload.single('loader'), (req, res) => {
    if (!req.session.user || req.session.user.username !== 'admin') return res.status(403).send('Нет доступа');
    if (!req.file) return res.redirect('/loader');
    const now = new Date().toLocaleDateString('ru-RU');
    fs.writeFileSync(META_FILE, JSON.stringify({
        version: (req.body.version || '1.0.0').trim(),
        date: now,
        filename: req.file.filename
    }));
    res.redirect('/loader');
});

module.exports = router;
