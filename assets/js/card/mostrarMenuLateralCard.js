const cards = document.querySelectorAll('.card');

cards.forEach(card => {
    const menuLateral = card.querySelector('.menu-lateral-card');
    let delayTimeout;

    card.addEventListener('mouseenter', () => {
        delayTimeout = setTimeout(() => {
            menuLateral.classList.add('mover-card');
        }, 900);
    });

    card.addEventListener('mouseleave', () => {
        clearTimeout(delayTimeout);
        menuLateral.classList.remove('mover-card');
    });
});