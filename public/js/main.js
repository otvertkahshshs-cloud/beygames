// Лайки
document.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const res = await fetch(`/forum/post/${id}/like`, { method: 'POST' });
        if (res.ok) {
            btn.classList.toggle('liked');
            const span = btn.querySelector('.like-count');
            span.textContent = parseInt(span.textContent) + (btn.classList.contains('liked') ? 1 : -1);
        }
    });
});

// Цитата
document.querySelectorAll('.quote-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const ta = document.querySelector('.reply-textarea');
        if (ta) {
            ta.value = `> ${btn.dataset.content}\n\n`;
            ta.focus();
        }
    });
});
