// script.js (com pinch-to-zoom + pan)
(function () {
  // ======= BASE =======
  const canvas = document.getElementById("puzzleCanvas");
  const ctx = canvas.getContext("2d");
  const container = document.getElementById("game-container");

  // Alta nitidez em telas high-DPI (desenhamos em unidades CSS)
  function fitCanvasToWindow() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // desenha em coordenadas CSS
  }

  // ======= GRID =======
  const rows = 3;
  const cols = 3;

  // ======= VARS DINÂMICAS =======
  let imageWidth = 0, imageHeight = 0;     // real
  let displayW = 0, displayH = 0;          // escalado p/ caber
  let srcPieceW = 0, srcPieceH = 0;        // recorte por peça (src)
  let pieceWidth = 0, pieceHeight = 0;     // peça no canvas (display)
  let offsetXTarget = 0, offsetYTarget = 0;// posição do quadro montado
  let scale = 1;                           // escala imagem->display

  const SNAP = 30;

  // ======= VIEWPORT (zoom/pan da câmera) =======
  let viewScale = 1;       // zoom da "câmera"
  let viewX = 0, viewY = 0;// pan da "câmera"

  function applyViewTransform() {
    ctx.save();
    ctx.translate(viewX, viewY);
    ctx.scale(viewScale, viewScale);
  }
  function restoreViewTransform() {
    ctx.restore();
  }
  function screenToWorld(x, y) {
    return { x: (x - viewX) / viewScale, y: (y - viewY) / viewScale };
  }
  function worldToScreen(x, y) {
    return { x: x * viewScale + viewX, y: y * viewScale + viewY };
  }

  // ======= FULLSCREEN + RESIZE =======
  function resizeCanvas() {
    fitCanvasToWindow();
    if (imageWidth && imageHeight) {
      computeLayout(true);
      pieces.forEach(p => { p.width = pieceWidth; p.height = pieceHeight; });
      drawAll();
    }
  }
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("orientationchange", resizeCanvas);
  resizeCanvas();

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

      this.srcX = col * srcPieceW;
      this.srcY = row * srcPieceH;

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
        this.srcX, this.srcY,
        srcPieceW, srcPieceH,
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

  // Move grupo A (arrastado) para colar no grupo B (parado)
  function mergeGroups(groupA, groupB, anchorPiece, otherPiece) {
    if (groupA === groupB) return;

    const dx = (otherPiece.canvasX + (anchorPiece.col - otherPiece.col) * pieceWidth) - anchorPiece.canvasX;
    const dy = (otherPiece.canvasY + (anchorPiece.row - otherPiece.row) * pieceHeight) - anchorPiece.canvasY;

    groups[groupA].forEach(p => {
      p.canvasX += dx;
      p.canvasY += dy;
      p.groupId = groupB;
    });

    groups[groupB] = groups[groupB].concat(groups[groupA]);
    groups[groupA] = [];
  }

  function moveGroup(groupId, dx, dy) {
    groups[groupId].forEach(p => {
      p.canvasX += dx;
      p.canvasY += dy;
    });
  }

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
        mergeGroups(piece.groupId, other.groupId, piece, other);
      }
    }
  }

  // ======= DRAW =======
  function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    applyViewTransform();
    // área-alvo (quadro montado)
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(offsetXTarget, offsetYTarget, displayW, displayH);

    pieces.forEach(p => p.draw());
    restoreViewTransform();
  }

  function checkCompleted() {
    return pieces.every(p => p.isInCorrectPosition());
  }

  // ======= LAYOUT (preenche tela; permite upscale) =======
  function computeLayout(preservePositions = false) {
    const margin = 20;
    // usar tamanho CSS do canvas com a câmera em 1:1
    const maxW = canvas.clientWidth  - margin * 2;
    const maxH = canvas.clientHeight - margin * 2;

    const prevOffsetX = offsetXTarget;
    const prevOffsetY = offsetYTarget;
    const prevPieceW  = pieceWidth  || 1;
    const prevPieceH  = pieceHeight || 1;

    // Sem ", 1" => upscaling para imagens menores
    scale = Math.min(maxW / imageWidth, maxH / imageHeight);

    displayW = Math.floor(imageWidth  * scale);
    displayH = Math.floor(imageHeight * scale);

    srcPieceW = imageWidth  / cols;
    srcPieceH = imageHeight / rows;

    pieceWidth  = displayW / cols;
    pieceHeight = displayH / rows;

    offsetXTarget = Math.floor((canvas.clientWidth  - displayW) / 2);
    offsetYTarget = Math.floor((canvas.clientHeight - displayH) / 2);

    if (preservePositions && pieces.length) {
      pieces.forEach(p => {
        const relX = (p.canvasX - prevOffsetX) / prevPieceW;
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

    computeLayout(false);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const startX = Math.random() * (canvas.clientWidth  - pieceWidth);
        const startY = Math.random() * (canvas.clientHeight - pieceHeight);
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

  // ======= INPUT (Pointer Events: mouse + touch) =======
  let activePointerId = null;
  const pointers = new Map(); // id -> {x,y}
  let pinch = null; // estado do gesto: {startDist, startScale, startMid, worldCenter}

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function updatePinchState() {
    if (pointers.size < 2) { pinch = null; return; }
    const pts = Array.from(pointers.values());
    const p0 = pts[0], p1 = pts[1];

    const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const dist = Math.hypot(dx, dy);

    if (!pinch) {
      // novo gesto
      pinch = {
        startDist: dist || 1,
        startScale: viewScale,
        startMid: mid,
        worldCenter: screenToWorld(mid.x, mid.y),
        startAngle: angleBetween(p0, p1),
        lastAngle: 0 // acumulador
      };
    } else {
      // pan com dois dedos: move a view pelo deslocamento do mid
      const dMidX = mid.x - pinch.startMid.x;
      const dMidY = mid.y - pinch.startMid.y;

      // Zoom relativo
      const newScale = Math.max(0.2, Math.min(5, pinch.startScale * (dist / pinch.startDist || 1)));

      const currentAngle = angleBetween(p0, p1);
      let deltaAngle = currentAngle - pinch.startAngle;

      // normaliza entre -π e π
      while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
      while (deltaAngle >  Math.PI) deltaAngle -= 2 * Math.PI;

      const angleDeg = deltaAngle * (180 / Math.PI); // opcional

      // Aplica rotação apenas se um grupo estiver ativo
      if (draggingGroup !== null) {
        const group = groups[draggingGroup];
        const centerX = group.reduce((sum, p) => sum + p.canvasX + p.width / 2, 0) / group.length;
        const centerY = group.reduce((sum, p) => sum + p.canvasY + p.height / 2, 0) / group.length;

        const sin = Math.sin(deltaAngle);
        const cos = Math.cos(deltaAngle);

        group.forEach(p => {
          const x = p.canvasX + p.width / 2 - centerX;
          const y = p.canvasY + p.height / 2 - centerY;

          const rx = x * cos - y * sin;
          const ry = x * sin + y * cos;

          p.canvasX = centerX + rx - p.width / 2;
          p.canvasY = centerY + ry - p.height / 2;
        });

        pinch.startAngle = currentAngle; // atualiza para próxima rodada
        drawAll();
      }


      // Manter o ponto do mundo sob o centro do gesto
      // s = screen = world * scale + view
      // Queremos: worldCenter desenhado em mid => view = mid - worldCenter*scale
      viewScale = newScale;
      const targetView = {
        x: mid.x - pinch.worldCenter.x * viewScale,
        y: mid.y - pinch.worldCenter.y * viewScale
      };

      // Acrescenta o pan do mid (para arrastar o quadro durante o pinch)
      viewX = targetView.x;
      viewY = targetView.y;

      drawAll();
    }
  }

  function angleBetween(p0, p1) {
    return Math.atan2(p1.y - p0.y, p1.x - p0.x); // ângulo em radianos
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const pos = getPos(e);
    pointers.set(e.pointerId, pos);

    if (pointers.size === 1) {
      // arrasto de peças
      activePointerId = e.pointerId;
      canvas.setPointerCapture(e.pointerId);

      const world = screenToWorld(pos.x, pos.y);
      for (let i = pieces.length - 1; i >= 0; i--) {
        if (pieces[i].isClicked(world.x, world.y)) {
          draggingGroup = pieces[i].groupId;

          const groupPieces = groups[draggingGroup];
          const minX = Math.min(...groupPieces.map(p => p.canvasX));
          const minY = Math.min(...groupPieces.map(p => p.canvasY));

          groupOffsetX = world.x - minX;
          groupOffsetY = world.y - minY;

          // trazer pra frente
          groupPieces.forEach(p => {
            const idx = pieces.indexOf(p);
            if (idx !== -1) { pieces.splice(idx, 1); pieces.push(p); }
          });
          drawAll();
          break;
        }
      }
    } else if (pointers.size === 2) {
      // inicia pinch
      updatePinchState();
      // enquanto pinch ativo, não arrastamos peças
      draggingGroup = null;
      activePointerId = null;
    }
  }, { passive: false });

  canvas.addEventListener("pointermove", (e) => {
    e.preventDefault();
    const pos = getPos(e);
    if (pointers.has(e.pointerId)) {
      pointers.set(e.pointerId, pos);
    }

    if (pointers.size >= 2) {
      updatePinchState();
      return;
    }

    if (draggingGroup === null || activePointerId !== e.pointerId) return;

    const world = screenToWorld(pos.x, pos.y);

    const groupPieces = groups[draggingGroup];
    const minX = Math.min(...groupPieces.map(p => p.canvasX));
    const minY = Math.min(...groupPieces.map(p => p.canvasY));

    const dx = world.x - groupOffsetX - minX;
    const dy = world.y - groupOffsetY - minY;

    moveGroup(draggingGroup, dx, dy);
    drawAll();
  }, { passive: false });

  function endPointer(e) {
    if (pointers.has(e.pointerId)) pointers.delete(e.pointerId);

    if (pointers.size < 2) pinch = null;

    if (activePointerId === e.pointerId) {
      if (draggingGroup !== null) {
        groups[draggingGroup].forEach(p => trySnap(p));
        drawAll();

        if (checkCompleted()) {
          setTimeout(() => {
            alert("Parabéns! Quebra-cabeça concluído!");
            location.reload();
          }, 10);
        }
      }
      draggingGroup = null;
      activePointerId = null;
      canvas.releasePointerCapture(e.pointerId);
    }
  }
  canvas.addEventListener("pointerup", endPointer, { passive: false });
  canvas.addEventListener("pointercancel", endPointer, { passive: false });

  // ======= ZOOM POR RODA DO MOUSE (desktop) =======
  canvas.addEventListener("wheel", (e) => {
    // Ctrl+roda ou roda simples — ajusta zoom
    e.preventDefault();
    const pos = getPos(e);
    const world = screenToWorld(pos.x, pos.y);

    const factor = Math.exp((e.deltaY > 0 ? -1 : 1) * 0.1); // suave
    const newScale = Math.max(0.2, Math.min(5, viewScale * factor));

    // mantém o ponto do mundo sob o cursor
    viewX = pos.x - world.x * newScale;
    viewY = pos.y - world.y * newScale;
    viewScale = newScale;

    drawAll();
  }, { passive: false });
})();

document.getElementById("btn-back").addEventListener("click", () => {
  history.back(); // voltar para a página anterior
});

document.getElementById("btn-refresh").addEventListener("click", () => {
  location.reload(); // recarregar a página
});