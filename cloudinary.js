const multer = require('multer');
const path = require('path');
const fs = require('fs');

const USE_CLOUDINARY = !!process.env.CLOUDINARY_URL;

// ─── Папки для локального режима ──────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');
const BANNERS_DIR = path.join(UPLOADS_DIR, 'banners');
const THREADS_DIR = path.join(UPLOADS_DIR, 'threads');
const FILES_DIR   = path.join(UPLOADS_DIR, 'files');

if (!USE_CLOUDINARY) {
    for (const dir of [UPLOADS_DIR, AVATARS_DIR, BANNERS_DIR, THREADS_DIR, FILES_DIR]) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
}

// ─── Cloudinary режим ─────────────────────────────────────────────────────────
let cloudinaryStorage;
if (USE_CLOUDINARY) {
    const cloudinary = require('cloudinary').v2;
    // CLOUDINARY_URL уже содержит все данные, cloudinary.config() подхватит автоматически
    const { CloudinaryStorage } = require('multer-storage-cloudinary');

    cloudinaryStorage = (folder, allowedFormats) => new CloudinaryStorage({
        cloudinary,
        params: async (req, file) => ({
            folder: `dealerhook/${folder}`,
            allowed_formats: allowedFormats,
            // Для gif — без трансформаций чтобы сохранить анимацию
            resource_type: 'image',
            format: undefined,
        }),
    });
}

// ─── Локальный storage ────────────────────────────────────────────────────────
function localStorage(destDir, nameFn) {
    return multer.diskStorage({
        destination: (req, file, cb) => cb(null, destDir),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
            cb(null, nameFn(req, file, ext));
        },
    });
}

const imageFilter = (req, file, cb) => {
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname) || /^image\//i.test(file.mimetype))
        cb(null, true);
    else cb(null, false);
};

// ─── uploadProfileFields (аватар + баннер) ────────────────────────────────────
const uploadProfileFields = multer({
    storage: USE_CLOUDINARY
        ? cloudinaryStorage('avatars', ['jpg', 'jpeg', 'png', 'gif', 'webp'])
        : multer.diskStorage({
            destination: (req, file, cb) => {
                const dir = file.fieldname === 'banner' ? BANNERS_DIR : AVATARS_DIR;
                cb(null, dir);
            },
            filename: (req, file, cb) => {
                const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
                cb(null, file.fieldname + '_' + req.session.user.id + ext);
            },
        }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: imageFilter,
}).fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
]);

// ─── Если Cloudinary — нужен отдельный storage для баннера (другая папка) ─────
let uploadProfileFieldsCombined;
if (USE_CLOUDINARY) {
    const cloudinary = require('cloudinary').v2;
    const { CloudinaryStorage } = require('multer-storage-cloudinary');

    const profileStorage = new CloudinaryStorage({
        cloudinary,
        params: async (req, file) => ({
            folder: file.fieldname === 'banner'
                ? 'dealerhook/banners'
                : 'dealerhook/avatars',
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
            resource_type: 'image',
        }),
    });

    uploadProfileFieldsCombined = multer({
        storage: profileStorage,
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: imageFilter,
    }).fields([
        { name: 'avatar', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
    ]);
} else {
    uploadProfileFieldsCombined = uploadProfileFields;
}

// ─── uploadThreadFields (картинка поста + файл-вложение) ──────────────────────
let uploadThreadFields;
if (USE_CLOUDINARY) {
    const cloudinary = require('cloudinary').v2;
    const { CloudinaryStorage } = require('multer-storage-cloudinary');

    const threadStorage = new CloudinaryStorage({
        cloudinary,
        params: async (req, file) => {
            const isImage = /^image\//i.test(file.mimetype) ||
                /\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname);
            if (isImage) {
                return {
                    folder: 'dealerhook/threads',
                    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
                    resource_type: 'image',
                };
            }
            // Файлы (zip, exe и т.д.) — raw тип
            return {
                folder: 'dealerhook/files',
                resource_type: 'raw',
                use_filename: true,
                unique_filename: true,
            };
        },
    });

    uploadThreadFields = multer({
        storage: threadStorage,
        limits: { fileSize: 100 * 1024 * 1024 },
    }).fields([{ name: 'file', maxCount: 1 }, { name: 'image', maxCount: 1 }]);
} else {
    const threadFieldStorage = multer.diskStorage({
        destination: (req, file, cb) => {
            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname) ||
                /^image\//i.test(file.mimetype);
            cb(null, isImage ? THREADS_DIR : FILES_DIR);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
            cb(null, Date.now() + '_' + Math.random().toString(36).slice(2) + '_' + base + ext);
        },
    });
    uploadThreadFields = multer({
        storage: threadFieldStorage,
        limits: { fileSize: 100 * 1024 * 1024 },
    }).fields([{ name: 'file', maxCount: 1 }, { name: 'image', maxCount: 1 }]);
}

// ─── Хелпер: получить URL из загруженного файла ───────────────────────────────
// Cloudinary кладёт URL в file.path, диск — нужно собирать вручную
function getFileUrl(file, localPrefix) {
    if (!file) return null;
    if (USE_CLOUDINARY) {
        // multer-storage-cloudinary кладёт публичный URL в file.path
        return file.path;
    }
    return localPrefix + '/' + file.filename;
}

module.exports = {
    uploadProfileFields: uploadProfileFieldsCombined,
    uploadThreadFields,
    getFileUrl,
    USE_CLOUDINARY,
    AVATARS_DIR,
    BANNERS_DIR,
    THREADS_DIR,
    FILES_DIR,
};
