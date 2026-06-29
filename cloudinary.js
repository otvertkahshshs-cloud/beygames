const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Хранилище для изображений постов/тредов
const threadImageStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'forum/threads',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        resource_type: 'image',
    },
});

// Хранилище для вложений (файлы: zip, exe, etc.)
const threadFileStorage = new CloudinaryStorage({
    cloudinary,
    params: (req, file) => ({
        folder: 'forum/attachments',
        resource_type: 'raw',
        public_id: Date.now() + '_' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'),
        use_filename: false,
    }),
});

// Хранилище для аватаров
const avatarStorage = new CloudinaryStorage({
    cloudinary,
    params: (req, file) => ({
        folder: 'forum/avatars',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        resource_type: 'image',
        public_id: 'avatar_' + req.session.user.id,
        overwrite: true,
        invalidate: true,
    }),
});

const uploadThreadImage = multer({
    storage: threadImageStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
});

const uploadThreadFile = multer({
    storage: threadFileStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
});

// Универсальный upload для тредов: fields image + file
// Т.к. multer-storage-cloudinary не поддерживает разные storage для одного upload.fields,
// используем memoryStorage + ручную загрузку в cloudinary
const memStorage = multer.memoryStorage();
const uploadThreadFields = multer({
    storage: memStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
}).fields([{ name: 'file', maxCount: 1 }, { name: 'image', maxCount: 1 }]);

const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
});

// Загрузить буфер в cloudinary вручную
function uploadBuffer(buffer, options) {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(options, (err, result) => {
            if (err) return reject(err);
            resolve(result);
        }).end(buffer);
    });
}

module.exports = {
    cloudinary,
    uploadThreadFields,
    uploadAvatar,
    uploadBuffer,
};
