function getRank(user) {
    if (user.role === 'admin') return { name: 'Администратор', css: 'rank-admin' };
    if (user.role === 'moderator') return { name: 'Модератор', css: 'rank-moderator' };
    const p = user.postsCount || 0;
    if (p >= 1000) return { name: 'Легенда', css: 'rank-legend' };
    if (p >= 300)  return { name: 'Ветеран', css: 'rank-veteran' };
    if (p >= 100)  return { name: 'Опытный', css: 'rank-experienced' };
    if (p >= 20)   return { name: 'Участник', css: 'rank-member' };
    return { name: 'Новичок', css: 'rank-newbie' };
}

module.exports = { getRank };
