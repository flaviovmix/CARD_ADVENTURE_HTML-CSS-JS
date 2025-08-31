const botoes = document.querySelectorAll('.btnMenuBolinhaCard');

botoes.forEach((botao, index) => {
    botao.addEventListener('click', () => {
        const areaInfo = document.querySelectorAll('.area-info-personagem')[index];
        const imagem = document.querySelectorAll('.img-principal')[index];

        areaInfo.classList.toggle('mostrar');
        imagem.classList.toggle('mostrar');
    });
});
