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

document.querySelectorAll('.area-link-fases a').forEach(function (item) {
    const icon = item.querySelector('.icone');
    const card = item.closest('.card'); // Encontra o card pai mais próximo
    const tituloDoCard = card.querySelector('#area-titulo-da-fase'); // Seleciona o título dentro do card

    item.addEventListener('mouseenter', function () {
        clearTimeout(timeoutVoltarPadrao);
        icon.style.transition = 'transform 0.3s ease';
        icon.style.transform = 'translateY(-8px)';

        const titulo = item.getAttribute('data-titulo');
        trocarTextoComFade(titulo, tituloDoCard); // Usa o título correto do card
    });

    item.addEventListener('mouseleave', function () {
        icon.style.transition = 'transform 0.3s ease';
        icon.style.transform = 'translateY(0)';

        timeoutVoltarPadrao = setTimeout(() => {
            trocarTextoComFade(nomePadrao, tituloDoCard); // Usa o título correto do card
        }, 1000);
    });
});