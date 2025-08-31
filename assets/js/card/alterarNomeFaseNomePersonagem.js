const tituloTexto = document.querySelectorAll('#area-titulo-da-fase'); // Seleciona todos os elementos com a ID 'area-titulo-da-fase'
const nomePadrao = 'VIDEL SATAN';
let timeoutVoltarPadrao = null;

function trocarTextoComFade(novoTexto, elementoTitulo) {
    elementoTitulo.classList.add('texto-fade');
    elementoTitulo.style.transform = 'translateX(-300px)';
    elementoTitulo.style.transition = 'transform 0.3s ease';

    setTimeout(() => {
        elementoTitulo.textContent = novoTexto;
        elementoTitulo.classList.remove('texto-fade');
        elementoTitulo.style.transform = 'translateX(0px)';
        elementoTitulo.style.transition = 'transform 0.3s ease';
    }, 300);
}

document.querySelectorAll('.card').forEach(function(card) {
    const tituloDoCard = card.querySelector('#area-titulo-da-fase'); 
    const nomePersonagem = tituloDoCard.textContent;

    card.querySelectorAll('.area-link-fases a').forEach(function (item) {
        const icon = item.querySelector('.icone');

        item.addEventListener('mouseenter', function () {
            clearTimeout(timeoutVoltarPadrao);
            icon.style.transition = 'transform 0.3s ease';
            icon.style.transform = 'translateY(-8px)';

            const titulo = item.getAttribute('data-titulo');
            trocarTextoComFade(titulo, tituloDoCard);
        });

        item.addEventListener('mouseleave', function () {
            icon.style.transition = 'transform 0.3s ease';
            icon.style.transform = 'translateY(0)';

            timeoutVoltarPadrao = setTimeout(() => {
                trocarTextoComFade(nomePersonagem, tituloDoCard); // volta pro nome original
            }, 1000);
        });
    });
});
