const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Папки для загрузок
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');
const THREADS_DIR = path.join(UPLOADS_DIR, 'threads');
const FILES_DIR   = path.join(UPLOADS_DIR, 'files');

// Создаём папки если не существуют
for (const dir of [UPLOADS_DIR, AVATARS_DIR, THREADS_DIR, FILES_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Хранилище для аватаров
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, AVATARS_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, 'avatar_' + req.session.user.id + ext);
    },
});

// Хранилище для изображений тредов
const threadImageStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, THREADS_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, Date.now() + '_' + Math.random().toString(36).slice(2) + ext);
    },
});

// Хранилище для файлов-вложений
const threadFileStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, FILES_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, Date.now() + '_' + base + ext);
    },
});

// Определяем storage по полю
const threadFieldStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname);
        cb(null, isImage ? THREADS_DIR : FILES_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, Date.now() + '_' + Math.random().toString(36).slice(2) + '_' + base + ext);
    },
});

const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname)) cb(null, true);
        else cb(new Error('Только изображения: jpg, png, gif, webp'));
    },
});

const uploadThreadFields = multer({
    storage: threadFieldStorage,
    limits: { fileSize: 100 * 1024 * 1024 },
}).fields([{ name: 'file', maxCount: 1 }, { name: 'image', maxCount: 1 }]);

// Заглушка uploadBuffer — не используется, но оставляем чтобы не ломать импорты
function uploadBuffer() {
    return Promise.reject(new Error('uploadBuffer не используется в локальном режиме'));
}

module.exports = {
    uploadThreadFields,
    uploadAvatar,
    uploadBuffer,
    AVATARS_DIR,
    THREADS_DIR,
    FILES_DIR,
};
