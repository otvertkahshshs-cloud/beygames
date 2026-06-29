const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Хранилище для аватаров — стриминг напрямую в Cloudinary
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

// Хранилище для вложений тредов — стриминг напрямую в Cloudinary
// resource_type: 'auto' — Cloudinary сам определяет image/video/raw
const threadAttachmentStorage = new CloudinaryStorage({
    cloudinary,
    params: (req, file) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname);
        return {
            folder: isImage ? 'forum/threads' : 'forum/attachments',
            resource_type: 'auto',
            public_id: Date.now() + '_' + safeName,
            use_filename: false,
            overwrite: false,
        };
    },
});

// uploadAvatar — аватары до 10 MB, стриминг
const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
});

// uploadThreadFields — вложения и изображения тредов до 100 MB, стриминг
// Используем один storage с resource_type: auto
const uploadThreadFields = multer({
    storage: threadAttachmentStorage,
    limits: { fileSize: 100 * 1024 * 1024 },
}).fields([{ name: 'file', maxCount: 1 }, { name: 'image', maxCount: 1 }]);

// Загрузить буфер в cloudinary вручную (используется в forum routes для совместимости)
// Теперь не нужна при стриминге, но оставляем для обратной совместимости
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
