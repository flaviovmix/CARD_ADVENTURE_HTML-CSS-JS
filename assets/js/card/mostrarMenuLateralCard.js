const cards = document.querySelectorAll('.card');

cards.forEach(card => {
    const menuLateral = card.querySelector('.menu-lateral-card');
    let delayTimeout;

    card.addEventListener('mouseenter', () => {
        // Espera 1 segundo antes de adicionar a classe
        delayTimeout = setTimeout(() => {
           
        }, 900); // 1000 milissegundos = 1 segundo
    });

    card.addEventListener('mouseleave', () => {
        // Cancela o timeout se o mouse sair antes de 1 segundo
        clearTimeout(delayTimeout);
       
    });
});