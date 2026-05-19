const nodemailer = require('nodemailer');

// Настрой свою почту здесь
const transporter = nodemailer.createTransport({
    host: 'smtp.mail.ru',
    port: 465,
    secure: true,
    auth: {
        user: 'goshamal@bk.ru',
        pass: 'ПАРОЛЬ_ОТ_ПОЧТЫ'
    }
});

async function sendVerificationCode(toEmail, code) {
    await transporter.sendMail({
        from: '"BeyGames Forum" <goshamal@bk.ru>',
        to: toEmail,
        subject: 'Подтверждение регистрации на BeyGames',
        html: `
        <div style="background:#111;color:#eee;padding:30px;font-family:sans-serif;border-radius:8px">
            <h2 style="color:#95b806">BeyGames</h2>
            <p>Ваш код подтверждения:</p>
            <div style="font-size:36px;font-weight:bold;color:#95b806;letter-spacing:8px;margin:20px 0">${code}</div>
            <p style="color:#888">Код действителен 10 минут. Если вы не регистрировались — проигнорируйте это письмо.</p>
        </div>
        `
    });
}

module.exports = { sendVerificationCode };
