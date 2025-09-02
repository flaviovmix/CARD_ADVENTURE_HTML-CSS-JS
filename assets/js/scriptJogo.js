// script.js
(function () {
  // ======= CONFIG BÁSICA =======
  const canvas = document.getElementById("puzzleCanvas");
  const ctx = canvas.getContext("2d");
  const container = document.getElementById("game-container");

  // Ajuste a dificuldade aqui:
  const rows = 1;  // linhas do quebra-cabeça
  const cols = 1;  // colunas do quebra-cabeça

  // Área alvo (tamanho real da imagem dentro do canvas)
  const imageWidth = 700;
  const imageHeight = 900;

  // Tolerância para "encaixar"
  const SNAP = 30;

  // Se você usa pastas com números (1..7), ajuste aqui:
  const MIN_NUM = 1;
  const MAX_NUM = 4;

  // ======= CAPTURA DE PARAMS =======
  const params = new URLSearchParams(window.location.search);
  const nome = params.get("nome"); // ex.: "CHUN-LI"
  const fase = params.get("fase"); // ex.: "TRAJES NORMAIS"

  // Data-atributo como fallback (pode ser caminho completo OU só nome do arquivo)
  const dataImg = container.getAttribute("data-img"); // ex.: "personagem2.png" ou "./assets/pixel_ai/x/y.png"

  // Normaliza caminho (sem assumir slug se você já renomeou as pastas)
  // Se quiser slugar automaticamente: descomente e use slugify(fase) na baseFolder.
  // const slugify = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');

  // Calcula offsets para centralizar a área de montagem (700x900) no canvas
  const offsetXTarget = (canvas.width - imageWidth) / 2;
  const offsetYTarget = (canvas.height - imageHeight) / 2;

  // Monta o caminho da imagem
  function buildImageSrc() {
    if (nome && fase) {
      const randomNum = Math.floor(Math.random() * (MAX_NUM - MIN_NUM + 1)) + MIN_NUM;
      const baseFolder = `./assets/pixel_ai/${nome}/${fase}`;
      return `${baseFolder}/${randomNum}.png`;
    }
    if (dataImg) {
      // Se veio com caminho (contém "/"), usamos direto.
      if (dataImg.includes("/")) return dataImg;
      // Se veio só o nome do arquivo, assumimos que está em ./assets/pixel_ai/
      return `./assets/pixel_ai/${dataImg}`;
    }
    // Último fallback (coloque um seu)
    return `./assets/pixel_ai/default/1.png`;
  }

  const imageSrc = buildImageSrc();
  const image = new Image();
  // Ajuda com caminhos contendo espaços/acentos
  image.src = imageSrc;

  // ======= LÓGICA DO QUEBRA-CABEÇA =======
  const pieceWidth = imageWidth / cols;
  const pieceHeight = imageHeight / rows;

  let pieces = [];
  let draggingPiece = null;
  let offsetX = 0, offsetY = 0;

  class Piece {
    constructor(imgX, imgY, canvasX, canvasY) {
      this.imgX = imgX;       // posição dentro da imagem
      this.imgY = imgY;
      this.canvasX = canvasX; // posição atual no canvas
      this.canvasY = canvasY;
      this.width = pieceWidth;
      this.height = pieceHeight;
      this.locked = false;
    }

    draw() {
      ctx.drawImage(
        image,
        this.imgX,
        this.imgY,
        this.width,
        this.height,
        this.canvasX,
        this.canvasY,
        this.width,
        this.height
      );
    }

    isClicked(x, y) {
      return (
        !this.locked &&
        x > this.canvasX &&
        x < this.canvasX + this.width &&
        y > this.canvasY &&
        y < this.canvasY + this.height
      );
    }

    isInCorrectPosition() {
      const expectedX = this.imgX + offsetXTarget;
      const expectedY = this.imgY + offsetYTarget;
      return (
        Math.abs(this.canvasX - expectedX) < SNAP &&
        Math.abs(this.canvasY - expectedY) < SNAP
      );
    }

    lockPosition() {
      this.canvasX = this.imgX + offsetXTarget;
      this.canvasY = this.imgY + offsetYTarget;
      this.locked = true;
    }
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Área de montagem (visual)
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.fillRect(offsetXTarget, offsetYTarget, imageWidth, imageHeight);

    // Desenha peças
    pieces.forEach(p => p.draw());
  }

  function checkCompleted() {
    return pieces.every(p => p.locked);
  }

  image.onload = function () {
    // Cria peças a partir da grade rows x cols
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const startX = Math.random() * (canvas.width - pieceWidth);
        const startY = Math.random() * (canvas.height - pieceHeight);
        pieces.push(
          new Piece(
            c * pieceWidth,         // recorte X na imagem
            r * pieceHeight,        // recorte Y na imagem
            startX,                 // posição inicial no canvas
            startY
          )
        );
      }
    }

    shuffle(pieces);
    drawAll();
  };

  image.onerror = function () {
    console.error("Falha ao carregar imagem:", imageSrc);
    // Opcional: fallback simples
    alert("Não foi possível carregar a imagem do quebra-cabeça.\nVerifique o caminho/pastas e os parâmetros da URL.");
  };

  // ======= INPUT DO MOUSE =======
  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    for (let i = pieces.length - 1; i >= 0; i--) {
      if (pieces[i].isClicked(mouseX, mouseY)) {
        draggingPiece = pieces[i];
        offsetX = mouseX - draggingPiece.canvasX;
        offsetY = mouseY - draggingPiece.canvasY;

        // traz a peça para "frente"
        pieces.splice(i, 1);
        pieces.push(draggingPiece);
        drawAll();
        break;
      }
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!draggingPiece) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    draggingPiece.canvasX = mouseX - offsetX;
    draggingPiece.canvasY = mouseY - offsetY;

    drawAll();
  });

  canvas.addEventListener("mouseup", () => {
    if (!draggingPiece) return;

 if (draggingPiece.isInCorrectPosition()) {
  draggingPiece.lockPosition();
  drawAll();
  if (checkCompleted()) {
    setTimeout(() => {
      alert("Parabéns! Quebra-cabeça concluído!");
      // recarrega a mesma página
      location.reload();

      // ou, se quiser ir para outra página / novo arquivo:
      // location.href = "quebra-cabeca2.html";
    }, 10);
  }
}

    draggingPiece = null;
  });

})();
