// script.js
(function () {
  // ======= CONFIG BÁSICA =======
  const canvas = document.getElementById("puzzleCanvas");
  const ctx = canvas.getContext("2d");
  const container = document.getElementById("game-container");

  // ======= GRID =======
  const rows = 2;  // linhas
  const cols = 2;  // colunas

  // ======= VARS DINÂMICAS (preenchidas depois) =======
  let imageWidth = 0, imageHeight = 0;     // tamanho REAL da imagem
  let displayW = 0, displayH = 0;          // tamanho ESCALADO (cabe no canvas)
  let srcPieceW = 0, srcPieceH = 0;        // tamanho do recorte por peça (na imagem real)
  let pieceWidth = 0, pieceHeight = 0;     // tamanho da peça desenhada no canvas
  let offsetXTarget = 0, offsetYTarget = 0;// canto sup-esq do "quadro" de montagem
  let scale = 1;

  const SNAP = 30;

  // ======= CANVAS FULLSCREEN + RESIZE =======
  function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    // se a imagem já carregou, recomputa layout e preserva posições
    if (imageWidth && imageHeight) {
      computeLayout(true);
      // atualiza o tamanho "display" das peças existentes
      pieces.forEach(p => { p.width = pieceWidth; p.height = pieceHeight; });
      drawAll();
    }
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas(); // inicializa

  // ======= PARAMS =======
  const params = new URLSearchParams(window.location.search);
  const nome = params.get("nome");
  const fase = params.get("fase");
  const numFotos = params.get("numFotos");
  const dataImg = container ? container.getAttribute("data-img") : null;

  const MIN_NUM = 1;
  const MAX_NUM = Number.isInteger(parseInt(numFotos, 10)) && parseInt(numFotos, 10) > 0
    ? parseInt(numFotos, 10)
    : 1;

  function buildImageSrc() {
    if (nome && fase) {
      const randomNum = Math.floor(Math.random() * (MAX_NUM - MIN_NUM + 1)) + MIN_NUM;
      const baseFolder = `./assets/pixel_ai/${encodeURIComponent(nome)}/${encodeURIComponent(fase)}`;
      return `${baseFolder}/${randomNum}.png`;
    }
    if (dataImg) {
      // Se vier caminho completo, usa direto; senão, prefixa a pasta padrão
      if (dataImg.includes("/")) return dataImg;
      return `./assets/pixel_ai/${dataImg}`;
    }
    return `./assets/pixel_ai/default/1.png`;
  }

  const imageSrc = buildImageSrc();
  const image = new Image();
  image.src = imageSrc;

  // ======= PEÇAS & GRUPOS =======
  let pieces = [];
  let groups = [];
  let draggingGroup = null;
  let groupOffsetX = 0, groupOffsetY = 0;

  class Piece {
    constructor(row, col, startX, startY) {
      this.row = row;
      this.col = col;

      // recorte na imagem ORIGINAL (SRC)
      this.srcX = col * srcPieceW;
      this.srcY = row * srcPieceH;

      // posição e tamanho no CANVAS (DISPLAY)
      this.canvasX = startX;
      this.canvasY = startY;
      this.width   = pieceWidth;
      this.height  = pieceHeight;

      this.locked = false;
      this.groupId = null;
    }

    draw() {
      ctx.drawImage(
        image,
        this.srcX, this.srcY,      // origem (src)
        srcPieceW, srcPieceH,      // tamanho do recorte (src)
        this.canvasX, this.canvasY,// destino (canvas)
        this.width, this.height    // tamanho no canvas (display)
      );
    }

    isClicked(x, y) {
      return (
        !this.locked &&
        x > this.canvasX && x < this.canvasX + this.width &&
        y > this.canvasY && y < this.canvasY + this.height
      );
    }

    isInCorrectPosition() {
      const expectedX = offsetXTarget + this.col * pieceWidth;
      const expectedY = offsetYTarget + this.row * pieceHeight;
      return (
        Math.abs(this.canvasX - expectedX) < SNAP &&
        Math.abs(this.canvasY - expectedY) < SNAP
      );
    }

    lockPosition() {
      this.canvasX = offsetXTarget + this.col * pieceWidth;
      this.canvasY = offsetYTarget + this.row * pieceHeight;
      this.locked = true;
    }
  }

  function createGroup(piece) {
    const groupId = groups.length;
    piece.groupId = groupId;
    groups.push([piece]);
  }

  // Move TODO o grupo A para colar no grupo B (âncora é otherPiece — grupo parado)
  function mergeGroups(groupA, groupB, anchorPiece, otherPiece) {
    if (groupA === groupB) return;

    // deslocamento necessário para que anchorPiece alinhe com otherPiece
    const dx = (otherPiece.canvasX + (anchorPiece.col - otherPiece.col) * pieceWidth) - anchorPiece.canvasX;
    const dy = (otherPiece.canvasY + (anchorPiece.row - otherPiece.row) * pieceHeight) - anchorPiece.canvasY;

    // aplica o deslocamento em todo o grupo A (o grupo que estava sendo arrastado)
    groups[groupA].forEach(p => {
      p.canvasX += dx;
      p.canvasY += dy;
      p.groupId = groupB;
    });

    // funde no grupo B e esvazia o A
    groups[groupB] = groups[groupB].concat(groups[groupA]);
    groups[groupA] = [];
  }

  function moveGroup(groupId, dx, dy) {
    groups[groupId].forEach(p => {
      p.canvasX += dx;
      p.canvasY += dy;
    });
  }

  // ======= SNAP ENTRE PEÇAS =======
  function trySnap(piece) {
    for (let other of pieces) {
      if (piece === other || other.locked) continue;

      const isNeighbor =
        (piece.row === other.row && Math.abs(piece.col - other.col) === 1) ||
        (piece.col === other.col && Math.abs(piece.row - other.row) === 1);

      if (!isNeighbor) continue;

      // diferença de col/row convertida para pixels "display"
      const dx = (other.col - piece.col) * pieceWidth;
      const dy = (other.row - piece.row) * pieceHeight;

      if (
        Math.abs((piece.canvasX + dx) - other.canvasX) < SNAP &&
        Math.abs((piece.canvasY + dy) - other.canvasY) < SNAP
      ) {
        // Alinha o grupo arrastado (groupA = piece.groupId) ao grupo parado (groupB = other.groupId)
        mergeGroups(piece.groupId, other.groupId, piece, other);
      }
    }
  }

  // ======= DRAW =======
  function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // área-alvo onde o quebra-cabeça "montado" ficaria
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(offsetXTarget, offsetYTarget, displayW, displayH);
    pieces.forEach(p => p.draw());
  }

  function checkCompleted() {
    return pieces.every(p => p.isInCorrectPosition());
  }

  // ======= LAYOUT DINÂMICO =======
  function computeLayout(preservePositions = false) {
    const margin = 20;
    const maxW = canvas.width  - margin * 2;
    const maxH = canvas.height - margin * 2;

    const prevOffsetX = offsetXTarget;
    const prevOffsetY = offsetYTarget;
    const prevPieceW  = pieceWidth  || 1;
    const prevPieceH  = pieceHeight || 1;

    // escala para caber no canvas, sem ampliar acima do original
    scale = Math.min(maxW / imageWidth, maxH / imageHeight);

    displayW = Math.floor(imageWidth  * scale);
    displayH = Math.floor(imageHeight * scale);

    // recorte no SRC (tamanho real), nunca muda com a escala
    srcPieceW = imageWidth  / cols;
    srcPieceH = imageHeight / rows;

    // tamanho da peça NO CANVAS (display)
    pieceWidth  = displayW / cols;
    pieceHeight = displayH / rows;

    // centraliza a área-alvo
    offsetXTarget = Math.floor((canvas.width  - displayW) / 2);
    offsetYTarget = Math.floor((canvas.height - displayH) / 2);

    // preserva posições proporcionais quando redimensionar
    if (preservePositions && pieces.length) {
      pieces.forEach(p => {
        const relX = (p.canvasX - prevOffsetX) / prevPieceW; // em "unidades de peça"
        const relY = (p.canvasY - prevOffsetY) / prevPieceH;
        p.canvasX = offsetXTarget + relX * pieceWidth;
        p.canvasY = offsetYTarget + relY * pieceHeight;
      });
    }
  }

  // ======= INICIALIZA =======
  image.onload = function () {
    imageWidth  = image.width;
    imageHeight = image.height;

    // calcula escala e dimensões iniciais
    computeLayout(false);

    // cria peças espalhadas
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const startX = Math.random() * (canvas.width  - pieceWidth);
        const startY = Math.random() * (canvas.height - pieceHeight);
        const piece = new Piece(r, c, startX, startY);
        pieces.push(piece);
        createGroup(piece);
      }
    }

    drawAll();
  };

  image.onerror = function () {
    console.error("Falha ao carregar imagem:", imageSrc);
    alert("Não foi possível carregar a imagem.");
  };

  // ======= INPUT MOUSE =======
  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    for (let i = pieces.length - 1; i >= 0; i--) {
      if (pieces[i].isClicked(mouseX, mouseY)) {
        draggingGroup = pieces[i].groupId;

        const groupPieces = groups[draggingGroup];
        const minX = Math.min(...groupPieces.map(p => p.canvasX));
        const minY = Math.min(...groupPieces.map(p => p.canvasY));

        groupOffsetX = mouseX - minX;
        groupOffsetY = mouseY - minY;

        // === TRAZER O GRUPO PRA FRENTE (desenhar por último) ===
        groupPieces.forEach(p => {
          const idx = pieces.indexOf(p);
          if (idx !== -1) {
            pieces.splice(idx, 1);
            pieces.push(p);
          }
        });

        drawAll();
        break;
      }
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    if (draggingGroup === null) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const groupPieces = groups[draggingGroup];
    const minX = Math.min(...groupPieces.map(p => p.canvasX));
    const minY = Math.min(...groupPieces.map(p => p.canvasY));

    const dx = mouseX - groupOffsetX - minX;
    const dy = mouseY - groupOffsetY - minY;

    moveGroup(draggingGroup, dx, dy);
    drawAll();
  });

  canvas.addEventListener("mouseup", () => {
    if (draggingGroup === null) return;

    groups[draggingGroup].forEach(p => trySnap(p));
    drawAll();

    if (checkCompleted()) {
      setTimeout(() => {
        alert("Parabéns! Quebra-cabeça concluído!");
        location.reload();
      }, 10);
    }

    draggingGroup = null;
  });
})();
