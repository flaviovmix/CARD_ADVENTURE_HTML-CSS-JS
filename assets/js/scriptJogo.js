(function () {

  // ── CANVAS ──────────────────────────────────────────────────────────────────
  const canvas    = document.getElementById("puzzleCanvas");
  const ctx       = canvas.getContext("2d");
  const container = document.getElementById("game-container");

  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width  = window.innerWidth  + "px";
    canvas.style.height = window.innerHeight + "px";
    canvas.width  = Math.floor(window.innerWidth  * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── PARAMS ──────────────────────────────────────────────────────────────────
  const params    = new URLSearchParams(window.location.search);
  const ROWS      = parseInt(params.get("linha"))    || 3;
  const COLS      = parseInt(params.get("coluna"))   || 3;
  const nome      = params.get("nome");
  const fase      = params.get("fase");
  const numFotos  = parseInt(params.get("numFotos")) || 1;
  const aleatoria = params.get("aleatoria");

  // ── LAYOUT ──────────────────────────────────────────────────────────────────
  let imgW = 0, imgH = 0;   // tamanho original da imagem
  let dispW = 0, dispH = 0; // tamanho exibido no canvas
  let pW = 0, pH = 0;       // tamanho de cada peça
  let ox = 0, oy = 0;       // origem do puzzle no canvas
  const SNAP = 28;

  function computeLayout(keepPos) {
    const margin  = 20;
    const scale   = Math.min(
      (canvas.clientWidth  - margin * 2) / imgW,
      (canvas.clientHeight - margin * 2) / imgH
    );
    const prevPW = pW || 1, prevPH = pH || 1;
    const prevOx = ox,      prevOy = oy;

    dispW = Math.floor(imgW * scale);
    dispH = Math.floor(imgH * scale);
    pW    = dispW / COLS;
    pH    = dispH / ROWS;
    ox    = Math.floor((canvas.clientWidth  - dispW) / 2);
    oy    = Math.floor((canvas.clientHeight - dispH) / 2);

    if (keepPos && pieces.length) {
      pieces.forEach(p => {
        p.x = ox + (p.x - prevOx) / prevPW * pW;
        p.y = oy + (p.y - prevOy) / prevPH * pH;
      });
    }
  }

  // ── CONECTORES JIGSAW ───────────────────────────────────────────────────────
  // hConn[r][c] = conector da borda DIREITA de (r,c) / borda ESQUERDA de (r,c+1)
  // vConn[r][c] = conector da borda INFERIOR de (r,c) / borda SUPERIOR de (r+1,c)
  // +1 = aba saindo, -1 = entalhe entrando (perspectiva da borda direita/inferior)
  let hConn = [], vConn = [];

  function initConnectors() {
    hConn = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS - 1 }, () => (Math.random() < .5 ? 1 : -1)));
    vConn = Array.from({ length: ROWS - 1 }, () =>
      Array.from({ length: COLS }, () => (Math.random() < .5 ? 1 : -1)));
  }

  // ── PATH JIGSAW ─────────────────────────────────────────────────────────────
  // Desenha uma aresta com aba (+1), entalhe (-1) ou reta (0).
  // As seções retas usam lineTo — isso garante que a aba de uma peça
  // e o entalhe da peça vizinha tenham exatamente a mesma curva (só direção invertida).
  function jigsawEdge(x1, y1, x2, y2, c) {
    if (c === 0) { ctx.lineTo(x2, y2); return; }
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    const nx = uy, ny = -ux;              // normal apontando para fora da peça
    const h  = len * 0.28 * c;           // +h = aba, -h = entalhe
    const ax = x1 + dx * .35, ay = y1 + dy * .35;   // início da aba/entalhe
    const bx = x1 + dx * .65, by = y1 + dy * .65;   // fim da aba/entalhe
    const mx = x1 + dx * .5 + nx * h,   // ponto mais extremo da aba/entalhe
          my = y1 + dy * .5 + ny * h;

    ctx.lineTo(ax, ay);   // seção reta até o início da aba/entalhe
    // ombro de entrada
    ctx.bezierCurveTo(
      ax + nx * h * 0.6,  ay + ny * h * 0.6,
      mx - ux * len * .12, my - uy * len * .12,
      mx, my
    );
    // ombro de saída (simétrico ao de entrada — garante encaixe perfeito)
    ctx.bezierCurveTo(
      mx + ux * len * .12, my + uy * len * .12,
      bx + nx * h * 0.6,  by + ny * h * 0.6,
      bx, by
    );
    ctx.lineTo(x2, y2);   // seção reta após a aba/entalhe
  }

  function buildPath(x, y, w, h, tc, rc, bc, lc) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    jigsawEdge(x,   y,   x+w, y,   tc);
    jigsawEdge(x+w, y,   x+w, y+h, rc);
    jigsawEdge(x+w, y+h, x,   y+h, bc);
    jigsawEdge(x,   y+h, x,   y,   lc);
    ctx.closePath();
  }

  // ── PEÇA ────────────────────────────────────────────────────────────────────
  let pieces = [], groups = [];
  let draggingGroup = null, grpOffX = 0, grpOffY = 0;
  let panning = false, panStartX = 0, panStartY = 0, panStartVx = 0, panStartVy = 0;
  let isSelecting = false, selStart = null, selEnd = null;
  let selectedPieces = new Set();
  let selDragging = false, selDragLastX = 0, selDragLastY = 0;

  class Piece {
    constructor(row, col) {
      this.row = row; this.col = col;
      this.x = 0; this.y = 0;
      this.locked = false;
      this.groupId = null;
    }
    // conectores de cada borda
    get tc() { return this.row > 0      ? -vConn[this.row-1][this.col] : 0; }
    get rc() { return this.col < COLS-1 ?  hConn[this.row][this.col]   : 0; }
    get bc() { return this.row < ROWS-1 ?  vConn[this.row][this.col]   : 0; }
    get lc() { return this.col > 0      ? -hConn[this.row][this.col-1] : 0; }
    // posição correta no puzzle montado
    get tx() { return ox + this.col * pW; }
    get ty() { return oy + this.row * pH; }

    draw() {
      const { x, y, tc, rc, bc, lc } = this;
      // deslocamento em relação à posição correta
      const ddx = x - this.tx, ddy = y - this.ty;

      ctx.save();
      buildPath(x, y, pW, pH, tc, rc, bc, lc);
      ctx.clip();
      // desenha a imagem completa deslocada — o clip revela só o trecho desta peça
      ctx.drawImage(image, ox + ddx, oy + ddy, dispW, dispH);
      ctx.restore();

      // contorno da peça (borda jigsaw visível)
      buildPath(x, y, pW, pH, tc, rc, bc, lc);
      ctx.strokeStyle = selectedPieces.has(this) ? "rgba(80,160,255,0.95)" : "rgba(0,0,0,0.45)";
      ctx.lineWidth   = selectedPieces.has(this) ? 2.5 / vs : 1.2;
      ctx.stroke();
    }

    hitTest(wx, wy) {
      if (this.locked) return false;
      buildPath(this.x, this.y, pW, pH, this.tc, this.rc, this.bc, this.lc);
      return ctx.isPointInPath(wx, wy);
    }

    isCorrect() {
      return Math.abs(this.x - this.tx) < SNAP && Math.abs(this.y - this.ty) < SNAP;
    }

    snapToGrid() {
      this.x = this.tx; this.y = this.ty; this.locked = true;
    }
  }

  // ── GRUPOS ──────────────────────────────────────────────────────────────────
  function createGroup(p) { p.groupId = groups.length; groups.push([p]); }

  function mergeGroups(gA, gB, anchor, other) {
    if (gA === gB) return;
    const dx = other.x + (anchor.col - other.col) * pW - anchor.x;
    const dy = other.y + (anchor.row - other.row) * pH - anchor.y;
    groups[gA].forEach(p => { p.x += dx; p.y += dy; p.groupId = gB; });
    groups[gB] = groups[gB].concat(groups[gA]);
    groups[gA] = [];
  }

  function moveGroup(gid, dx, dy) { groups[gid].forEach(p => { p.x += dx; p.y += dy; }); }

  function trySnap(piece) {
    for (const other of pieces) {
      if (piece === other || other.locked) continue;
      const neighbor =
        (piece.row === other.row && Math.abs(piece.col - other.col) === 1) ||
        (piece.col === other.col && Math.abs(piece.row - other.row) === 1);
      if (!neighbor) continue;
      const dx = (other.col - piece.col) * pW;
      const dy = (other.row - piece.row) * pH;
      if (Math.abs(piece.x + dx - other.x) < SNAP &&
          Math.abs(piece.y + dy - other.y) < SNAP) {
        mergeGroups(piece.groupId, other.groupId, piece, other);
      }
    }
  }

  // ── RENDERIZAÇÃO ────────────────────────────────────────────────────────────
  function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // fundo escuro
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    applyView();

    // imagem fantasma: ajuda a ver onde encaixar e preenche visualmente
    // as áreas de entalhe das peças ainda não montadas
    ctx.globalAlpha = 0.13;
    ctx.drawImage(image, ox, oy, dispW, dispH);
    ctx.globalAlpha = 1;

    pieces.forEach(p => p.draw());

    // retângulo de seleção (rubber band)
    if (isSelecting && selStart && selEnd) {
      const rx = Math.min(selStart.x, selEnd.x), ry = Math.min(selStart.y, selEnd.y);
      const rw = Math.abs(selEnd.x - selStart.x), rh = Math.abs(selEnd.y - selStart.y);
      ctx.fillStyle   = "rgba(80,160,255,0.08)";
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = "rgba(80,160,255,0.85)";
      ctx.lineWidth   = 1 / vs;
      ctx.setLineDash([6 / vs, 3 / vs]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
    }

    restoreView();
  }

  // ── VIEWPORT (zoom / pan) ───────────────────────────────────────────────────
  let vx = 0, vy = 0, vs = 1;
  function applyView()   { ctx.save(); ctx.translate(vx, vy); ctx.scale(vs, vs); }
  function restoreView() { ctx.restore(); }
  function toWorld(x, y) { return { x: (x - vx) / vs, y: (y - vy) / vs }; }

  // ── IMAGEM ──────────────────────────────────────────────────────────────────
  function buildSrc() {
    if (nome && fase) {
      const n = aleatoria === "0"
        ? Math.floor(Math.random() * numFotos) + 1
        : (parseInt(aleatoria) || 1);
      return `./assets/pixel_ai/${encodeURIComponent(nome)}/${encodeURIComponent(fase)}/${n}.png`;
    }
    const di = container?.getAttribute("data-img");
    return di
      ? (di.includes("/") ? di : `./assets/pixel_ai/${di}`)
      : `./assets/pixel_ai/default/1.png`;
  }

  const image = new Image();
  image.src = buildSrc();

  image.onload = function () {
    imgW = image.width;
    imgH = image.height;
    computeLayout(false);
    initConnectors();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = new Piece(r, c);
        p.x = Math.random() * Math.max(0, canvas.clientWidth  - pW);
        p.y = Math.random() * Math.max(0, canvas.clientHeight - pH);
        pieces.push(p);
        createGroup(p);
      }
    }
    drawAll();
  };

  image.onerror = () => alert("Não foi possível carregar a imagem.");

  // ── RESIZE ──────────────────────────────────────────────────────────────────
  function onResize() {
    fitCanvas();
    if (imgW) { computeLayout(true); drawAll(); }
  }
  window.addEventListener("resize",            onResize);
  window.addEventListener("orientationchange", onResize);
  fitCanvas();

  // ── EVENTOS DE ENTRADA ──────────────────────────────────────────────────────
  const pointers = new Map();
  let activePtr = null, pinch = null;

  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function updatePinch() {
    if (pointers.size < 2) { pinch = null; return; }
    const [p0, p1] = [...pointers.values()];
    const mid  = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);

    if (!pinch) {
      pinch = { startDist: dist || 1, startScale: vs, startMid: mid,
                worldCenter: toWorld(mid.x, mid.y),
                startAngle: Math.atan2(p1.y - p0.y, p1.x - p0.x) };
    } else {
      const newScale = Math.max(.2, Math.min(5, pinch.startScale * dist / pinch.startDist));

      // rotação do grupo arrastado via pinch
      if (draggingGroup !== null) {
        const grp = groups[draggingGroup];
        const cx  = grp.reduce((s, p) => s + p.x + pW / 2, 0) / grp.length;
        const cy  = grp.reduce((s, p) => s + p.y + pH / 2, 0) / grp.length;
        const da  = Math.atan2(p1.y - p0.y, p1.x - p0.x) - pinch.startAngle;
        const sin = Math.sin(da), cos = Math.cos(da);
        grp.forEach(p => {
          const rx = p.x + pW / 2 - cx, ry = p.y + pH / 2 - cy;
          p.x = cx + rx * cos - ry * sin - pW / 2;
          p.y = cy + rx * sin + ry * cos - pH / 2;
        });
        pinch.startAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      }

      vs = newScale;
      vx = mid.x - pinch.worldCenter.x * vs;
      vy = mid.y - pinch.worldCenter.y * vs;
      drawAll();
    }
  }

  canvas.addEventListener("contextmenu", e => e.preventDefault());

  canvas.addEventListener("pointerdown", e => {
    e.preventDefault();
    const pos = getPos(e);
    pointers.set(e.pointerId, pos);

    if (pointers.size === 1) {
      activePtr = e.pointerId;
      canvas.setPointerCapture(e.pointerId);

      // ── botão do meio: pan ──────────────────────────────────────────────────
      if (e.button === 1) {
        panning = true;
        panStartX = pos.x; panStartY = pos.y;
        panStartVx = vx;   panStartVy = vy;
        return;
      }

      const w = toWorld(pos.x, pos.y);

      // ── botão esquerdo: peça ou rubber-band ─────────────────────────────────
      let hitPiece = false;
      for (let i = pieces.length - 1; i >= 0; i--) {
        if (!pieces[i].hitTest(w.x, w.y)) continue;
        const clicked = pieces[i];

        if (selectedPieces.has(clicked) && selectedPieces.size > 1) {
          // arrastar todas as peças selecionadas juntas
          selDragging  = true;
          selDragLastX = w.x;
          selDragLastY = w.y;
          // traz todas para frente
          selectedPieces.forEach(sp => { pieces.splice(pieces.indexOf(sp), 1); pieces.push(sp); });
        } else {
          // arrastar grupo normal (uma peça ou grupo já montado)
          selectedPieces.clear();
          draggingGroup = clicked.groupId;
          const grp = groups[draggingGroup];
          grpOffX = w.x - Math.min(...grp.map(p => p.x));
          grpOffY = w.y - Math.min(...grp.map(p => p.y));
          grp.forEach(p => { pieces.splice(pieces.indexOf(p), 1); pieces.push(p); });
        }
        hitPiece = true;
        drawAll();
        break;
      }

      // ── área vazia: iniciar rubber-band ────────────────────────────────────
      if (!hitPiece) {
        selectedPieces.clear();
        isSelecting = true;
        selStart = { x: w.x, y: w.y };
        selEnd   = { x: w.x, y: w.y };
        drawAll();
      }

    } else if (pointers.size === 2) {
      updatePinch();
      draggingGroup = null;
      isSelecting   = false;
      selDragging   = false;
      activePtr     = null;
    }
  }, { passive: false });

  canvas.addEventListener("pointermove", e => {
    e.preventDefault();
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, getPos(e));
    if (pointers.size >= 2) { updatePinch(); return; }
    if (activePtr !== e.pointerId) return;

    const curPos = getPos(e);
    const w = toWorld(curPos.x, curPos.y);

    if (panning) {
      vx = panStartVx + (curPos.x - panStartX);
      vy = panStartVy + (curPos.y - panStartY);
      drawAll();
      return;
    }

    if (isSelecting) {
      selEnd = { x: w.x, y: w.y };
      drawAll();
      return;
    }

    if (selDragging) {
      const dx = w.x - selDragLastX, dy = w.y - selDragLastY;
      selectedPieces.forEach(p => { p.x += dx; p.y += dy; });
      selDragLastX = w.x; selDragLastY = w.y;
      drawAll();
      return;
    }

    if (draggingGroup === null) return;
    const grp = groups[draggingGroup];
    moveGroup(draggingGroup,
      w.x - grpOffX - Math.min(...grp.map(p => p.x)),
      w.y - grpOffY - Math.min(...grp.map(p => p.y)));
    drawAll();
  }, { passive: false });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (activePtr !== e.pointerId) return;

    panning = false;

    // ── finaliza rubber-band: seleciona peças dentro do rect ──────────────────
    if (isSelecting) {
      isSelecting = false;
      const x1 = Math.min(selStart.x, selEnd.x), y1 = Math.min(selStart.y, selEnd.y);
      const x2 = Math.max(selStart.x, selEnd.x), y2 = Math.max(selStart.y, selEnd.y);
      if (x2 - x1 > 5 || y2 - y1 > 5) {
        pieces.forEach(p => {
          if (p.x < x2 && p.x + pW > x1 && p.y < y2 && p.y + pH > y1)
            selectedPieces.add(p);
        });
      }
      drawAll();
      activePtr = null;
      canvas.releasePointerCapture(e.pointerId);
      return;
    }

    // ── finaliza arrastar seleção múltipla ────────────────────────────────────
    if (selDragging) {
      selDragging = false;
      selectedPieces.forEach(p => trySnap(p));
      drawAll();
      if (pieces.every(p => p.isCorrect()))
        setTimeout(() => { alert("Parabéns! Quebra-cabeça concluído!"); location.reload(); }, 10);
      activePtr = null;
      canvas.releasePointerCapture(e.pointerId);
      return;
    }

    if (draggingGroup !== null) {
      groups[draggingGroup].forEach(p => trySnap(p));
      drawAll();
      if (pieces.every(p => p.isCorrect())) {
        setTimeout(() => { alert("Parabéns! Quebra-cabeça concluído!"); location.reload(); }, 10);
      }
    }
    draggingGroup = null;
    activePtr = null;
    canvas.releasePointerCapture(e.pointerId);
  }
  canvas.addEventListener("pointerup",     endPointer, { passive: false });
  canvas.addEventListener("pointercancel", endPointer, { passive: false });

  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    const pos = getPos(e);
    const w   = toWorld(pos.x, pos.y);
    const ns  = Math.max(.2, Math.min(5, vs * Math.exp((e.deltaY > 0 ? -1 : 1) * .1)));
    vx = pos.x - w.x * ns;
    vy = pos.y - w.y * ns;
    vs = ns;
    drawAll();
  }, { passive: false });

})();

// ── BOTÕES ──────────────────────────────────────────────────────────────────
const backBtn    = document.getElementById("btn-back");
const refreshBtn = document.getElementById("btn-refresh");
if (backBtn)    backBtn.addEventListener("click",    () => history.back());
if (refreshBtn) refreshBtn.addEventListener("click", () => location.reload());
