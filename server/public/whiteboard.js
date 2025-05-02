// Canvas setup
const canvas = document.getElementById("whiteboard");
const ctx = canvas.getContext("2d");
const canvasBgColor = "#f2f4f8";

// Tools and session info
const colorPicker = document.getElementById("colorPicker");
const brushSize = document.getElementById("brushSize");
const toolButtons = document.querySelectorAll(".tool-btn");

const sessionId = new URLSearchParams(window.location.search).get("session");
const userName = new URLSearchParams(window.location.search).get("name") || "Anonymous";
const isHost = new URLSearchParams(window.location.search).get("host") === "true";

// Display session ID
document.getElementById("sessionIdDisplay").innerText = sessionId;
document.getElementById("copyBtn").onclick = () => {
  navigator.clipboard.writeText(sessionId);
  alert("Session key copied!");
};

// Connect to server
const socket = io();
socket.emit("joinSession", { sessionId, name: userName, isHost });

// Set canvas size
canvas.width = window.innerWidth - 320;
canvas.height = window.innerHeight - 160;

// Preview layer for shape outlines
const previewCanvas = document.getElementById("previewLayer");
const pctx = previewCanvas.getContext("2d");
previewCanvas.width = canvas.width;
previewCanvas.height = canvas.height;

// Fill canvas background
ctx.fillStyle = canvasBgColor;
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Drawing state
let tool = "freehand";
let isDrawing = false;
let startX, startY;
let currentPath = [];

// Tool selection
toolButtons.forEach((btn) => {
  btn.onclick = () => {
    tool = btn.getAttribute("data-tool");
    toolButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  };
});

// Mouse down handler
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;
  isDrawing = true;

  if (tool === "freehand" || tool === "eraser") {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    currentPath = [{ x: startX, y: startY }];
  }

  if (tool === "fill") {
    ctx.fillStyle = colorPicker.value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    socket.emit("shape", { sessionId, type: "fill", color: ctx.fillStyle });
    isDrawing = false;
    sendSnapshot();
  }
});

// Mouse move handler
canvas.addEventListener("mousemove", (e) => {
  if (!isDrawing) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (tool === "freehand" || tool === "eraser") {
    ctx.strokeStyle = tool === "eraser" ? canvasBgColor : colorPicker.value;
    ctx.lineWidth = brushSize.value;
    ctx.lineTo(x, y);
    ctx.stroke();
    currentPath.push({ x, y });
  } else {
    drawPreviewShape(startX, startY, x, y);
  }
});

// Mouse up handler
canvas.addEventListener("mouseup", (e) => {
  if (!isDrawing) return;
  isDrawing = false;
  const rect = canvas.getBoundingClientRect();
  const endX = e.clientX - rect.left;
  const endY = e.clientY - rect.top;
  clearPreview();

  const strokeColor = tool === "eraser" ? canvasBgColor : colorPicker.value;

  if (tool === "freehand" || tool === "eraser") {
    socket.emit("draw", {
      sessionId,
      path: currentPath,
      color: strokeColor,
      size: brushSize.value,
    });
    sendSnapshot();
  } else if (tool !== "fill") {
    drawFinalShape(startX, startY, endX, endY, true);
    sendSnapshot();
  }
});

// Show shape preview on drag
function drawPreviewShape(x1, y1, x2, y2) {
  pctx.clearRect(0, 0, canvas.width, canvas.height);
  pctx.beginPath();
  pctx.strokeStyle = colorPicker.value;
  pctx.lineWidth = brushSize.value;

  if (type === "rectangle") {
    pctx.rect(x1, y1, x2 - x1, y2 - y1);
  } else if (type === "circle") {
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const radiusX = Math.abs((x2 - x1) / 2);
    const radiusY = Math.abs((y2 - y1) / 2);
    pctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  } else if (type === "triangle") {
    pctx.moveTo(x1, y1);
    pctx.lineTo(x2, y2);
    pctx.lineTo(x1 - (x2 - x1), y2);
    pctx.closePath();
  }

  pctx.stroke();
}

// Clear preview canvas
function clearPreview() {
  pctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Draw final shape on main canvas
function drawFinalShape(x1, y1, x2, y2, emit, type = tool, size = brushSize.value) {
  ctx.beginPath();
  ctx.strokeStyle = colorPicker.value;
  ctx.lineWidth = size;

  if (type === "rectangle") {
    ctx.rect(x1, y1, x2 - x1, y2 - y1);
  } else if (type === "circle") {
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const radiusX = Math.abs((x2 - x1) / 2);
    const radiusY = Math.abs((y2 - y1) / 2);
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  } else if (type === "triangle") {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x1 - (x2 - x1), y2);
    ctx.closePath();
  }

  ctx.stroke();

  if (emit) {
    socket.emit("shape", {
      sessionId,
      type: tool,
      x1,
      y1,
      x2,
      y2,
      color: ctx.strokeStyle,
      size: ctx.lineWidth,
    });
  }
}

// Clear canvas and send snapshot
window.clearBoard = function () {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = canvasBgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  sendSnapshot();
};

// Send snapshot to server
function sendSnapshot() {
  const image = canvas.toDataURL("image/png");
  socket.emit("snapshot", { sessionId, image });
}

// Load snapshot when joining session
socket.on("loadSnapshot", (imageData) => {
  const img = new Image();
  img.onload = () => ctx.drawImage(img, 0, 0);
  img.src = imageData;
});

// Render drawing from other users
socket.on("draw", (data) => {
  ctx.strokeStyle = data.color;
  ctx.lineWidth = data.size;
  ctx.beginPath();
  ctx.moveTo(data.path[0].x, data.path[0].y);
  for (let i = 1; i < data.path.length; i++) {
    ctx.lineTo(data.path[i].x, data.path[i].y);
  }
  ctx.stroke();
});

// Render shape from other users
socket.on("shape", (data) => {
  if (data.type === "fill") {
    ctx.fillStyle = data.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    drawFinalShape(data.x1, data.y1, data.x2, data.y2, false, data.type, data.size);
  }
});
