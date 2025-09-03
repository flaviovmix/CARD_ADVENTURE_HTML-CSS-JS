// script.js
(function () {
  // ======= CONFIG BÁSICA =======
  const canvas = document.getElementById("puzzleCanvas");
  const ctx = canvas.getContext("2d");
  const container = document.getElementById("game-container");

  const rows = 4;  // linhas
  const cols = 3;  // colunas

  const imageWidth = 700;
  const imageHeight = 900;

  // ======= PARAMS =======
  const params = new URLSearchParams(window.location.search);
  const nome = params.get("nome");
  const fase = params.get("fase");
  const numFotos = params.get("numFotos");
  const dataImg = container.getAttribute("data-img");

  const SNAP = 30;
  const MIN_NUM = 1;
  const MAX_NUM = numFotos;

  const offsetXTarget = (canvas.width - imageWidth) / 2;
  const offsetYTarget = (canvas.height - imageHeight) / 2;

  function buildImageSrc() {
    if (nome && fase) {
      const randomNum = Math.floor(Math.random() * (MAX_NUM - MIN_NUM + 1)) + MIN_NUM;
      const baseFolder = `./assets/pixel_ai/${nome}/${fase}`;
      return `${baseFolder}/${randomNum}.png`;
    }
    if (dataImg) {
      if (dataImg.includes("/")) return dataImg;
      return `./assets/pixel_ai/${dataImg}`;
    }
    return `./assets/pixel_ai/default/1.png`;
  }

  const imageSrc = buildImageSrc();
  const image = new Image();
  image.src = imageSrc;

  // ======= PEÇAS & GRUPOS =======
  const pieceWidth = imageWidth / cols;
  const pieceHeight = imageHeight / rows;

  let pieces = [];
  let groups = [];
  let draggingGroup = null;
  let groupOffsetX = 0, groupOffsetY = 0;

  class Piece {
    constructor(row, col, startX, startY) {
      this.row = row;
      this.col = col;
      this.imgX = col * pieceWidth;
      this.imgY = row * pieceHeight;
      this.canvasX = startX;
      this.canvasY = startY;
      this.width = pieceWidth;
      this.height = pieceHeight;
      this.locked = false;
      this.groupId = null;
    }

    draw() {
      ctx.drawImage(
        image,
        this.imgX, this.imgY,
        this.width, this.height,
        this.canvasX, this.canvasY,
        this.width, this.height
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

  // ======= GRUPOS =======
  function createGroup(piece) {
    const groupId = groups.length;
    piece.groupId = groupId;
    groups.push([piece]);
  }

  function mergeGroups(groupA, groupB, anchorPiece, otherPiece) {
    if (groupA === groupB) return;

    // diferença entre onde o "otherPiece" está e onde deveria estar
    const dx = (anchorPiece.canvasX + (otherPiece.col - anchorPiece.col) * pieceWidth) - otherPiece.canvasX;
    const dy = (anchorPiece.canvasY + (otherPiece.row - anchorPiece.row) * pieceHeight) - otherPiece.canvasY;

    // aplicar o deslocamento em todo o grupo B
    groups[groupB].forEach(p => {
      p.canvasX += dx;
      p.canvasY += dy;
      p.groupId = groupA;
    });

    // fundir grupos
    groups[groupA] = groups[groupA].concat(groups[groupB]);
    groups[groupB] = [];
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

      const dx = (other.col - piece.col) * pieceWidth;
      const dy = (other.row - piece.row) * pieceHeight;

      if (
        Math.abs((piece.canvasX + dx) - other.canvasX) < SNAP &&
        Math.abs((piece.canvasY + dy) - other.canvasY) < SNAP
      ) {
        // alinhar outro grupo com base na peça atual
        mergeGroups(piece.groupId, other.groupId, piece, other);
      }
    }
  }

  function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(offsetXTarget, offsetYTarget, imageWidth, imageHeight);
    pieces.forEach(p => p.draw());
  }

  function checkCompleted() {
    return pieces.every(p => p.isInCorrectPosition());
  }

  // ======= INICIALIZA =======
  image.onload = function () {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const startX = Math.random() * (canvas.width - pieceWidth);
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

        // calcular offset em relação ao grupo inteiro (mínimo X e Y do grupo)
        const groupPieces = groups[draggingGroup];
        const minX = Math.min(...groupPieces.map(p => p.canvasX));
        const minY = Math.min(...groupPieces.map(p => p.canvasY));

        groupOffsetX = mouseX - minX;
        groupOffsetY = mouseY - minY;

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
