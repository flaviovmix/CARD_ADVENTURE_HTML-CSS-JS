const canvas = document.getElementById("puzzleCanvas");
  const ctx = canvas.getContext("2d");

  const rows = 1;
  const cols = 1;

  const imageWidth = 700;
  const imageHeight = 900;

  const pieceWidth = imageWidth / cols;
  const pieceHeight = imageHeight / rows;

  const offsetXTarget = (canvas.width - imageWidth) / 2;
  const offsetYTarget = (canvas.height - imageHeight) / 2;

const params = new URLSearchParams(window.location.search);

// pega a pasta passada na URL
const baseFolder = params.get("img") || "./assets/pixel_ai/default";

// sorteia 1 ou 2
const randomNum = Math.floor(Math.random() * 7) + 1;

// monta o caminho do arquivo dentro da pasta
const imageSrc = `${baseFolder}/${randomNum}.png`;

console.log(imageSrc);

const image = new Image();
image.src = imageSrc;


  let pieces = [];
  let draggingPiece = null;
  let offsetX, offsetY;

  class Piece {
      constructor(imgX, imgY, canvasX, canvasY) {
          this.imgX = imgX;
          this.imgY = imgY;
          this.canvasX = canvasX;
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
              Math.abs(this.canvasX - expectedX) < 30 &&
              Math.abs(this.canvasY - expectedY) < 30
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

  image.onload = function () {
      for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
              pieces.push(
                  new Piece(
                      col * pieceWidth,
                      row * pieceHeight,
                      Math.random() * (canvas.width - pieceWidth),
                      Math.random() * (canvas.height - pieceHeight)
                  )
              );
          }
      }

      shuffle(pieces);
      drawAll();
  };

  function drawAll() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Área de montagem exata (700x900)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(offsetXTarget, offsetYTarget, imageWidth, imageHeight);

      pieces.forEach(piece => piece.draw());
  }

  canvas.addEventListener("mousedown", (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      for (let i = pieces.length - 1; i >= 0; i--) {
          if (pieces[i].isClicked(mouseX, mouseY)) {
              draggingPiece = pieces[i];
              offsetX = mouseX - draggingPiece.canvasX;
              offsetY = mouseY - draggingPiece.canvasY;

              pieces.splice(i, 1);
              pieces.push(draggingPiece);
              drawAll();
              break;
          }
      }
  });

  canvas.addEventListener("mousemove", (e) => {
      if (draggingPiece) {
          const rect = canvas.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          draggingPiece.canvasX = mouseX - offsetX;
          draggingPiece.canvasY = mouseY - offsetY;

          drawAll();
      }
  });

  canvas.addEventListener("mouseup", () => {
      if (draggingPiece) {
          if (draggingPiece.isInCorrectPosition()) {
              draggingPiece.lockPosition();
          }
          draggingPiece = null;
          drawAll();
      }
  });