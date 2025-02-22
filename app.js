// Base class for tools
class Tool {
  constructor(whiteboard) {
    this.whiteboard = whiteboard;
  }
  onMouseDown(pos) {}
  onMouseMove(pos) {}
  onMouseUp(pos) {}
}

// RoundPen: draws with round line caps and joins using a constant width.
class RoundPen extends Tool {
  constructor(whiteboard) {
    super(whiteboard);
    this.lineWidth = whiteboard.penLineWidth;
    this.color = whiteboard.currentColor;
  }
  onMouseDown(pos) {
    const ctx = this.whiteboard.ctx;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineWidth = this.lineWidth;
    ctx.strokeStyle = this.color;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  onMouseMove(pos) {
    const ctx = this.whiteboard.ctx;
    ctx.lineWidth = this.lineWidth;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }
  onMouseUp(pos) {}
}

// FlatPen: draws with flat (butt) caps and miter joins using a constant width.
class FlatPen extends Tool {
  constructor(whiteboard) {
    super(whiteboard);
    this.lineWidth = whiteboard.penLineWidth;
    this.color = whiteboard.currentColor;
  }
  onMouseDown(pos) {
    const ctx = this.whiteboard.ctx;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineWidth = this.lineWidth;
    ctx.strokeStyle = this.color;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
  }
  onMouseMove(pos) {
    const ctx = this.whiteboard.ctx;
    ctx.lineWidth = this.lineWidth;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }
  onMouseUp(pos) {}
}

// BrushPen: supports pressure by recording points (with pressure) and then drawing a variable‑width stroke.
class BrushPen extends Tool {
  constructor(whiteboard) {
    super(whiteboard);
    this.lineWidth = whiteboard.penLineWidth; // base width
    this.color = whiteboard.currentColor;
    this.points = [];
  }
  onMouseDown(pos) {
    this.points = [];
    this.points.push(pos);
  }
  onMouseMove(pos) {
    this.points.push(pos);
    // Optional live feedback: draw a small circle at the current point.
    const ctx = this.whiteboard.ctx;
    ctx.save();
    let computedWidth = this.whiteboard.calculateLineWidth(this.lineWidth, pos.pressure);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, computedWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  onMouseUp(pos) {
    this.points.push(pos);
    this.drawStroke();
  }
  drawStroke() {
    const pts = this.points;
    if (pts.length < 2) return;
    const ctx = this.whiteboard.ctx;
    let left = [], right = [];
    for (let i = 0; i < pts.length; i++) {
      let p = pts[i];
      let dx, dy;
      if (i === 0) {
        dx = pts[i + 1].x - p.x;
        dy = pts[i + 1].y - p.y;
      } else if (i === pts.length - 1) {
        dx = p.x - pts[i - 1].x;
        dy = p.y - pts[i - 1].y;
      } else {
        dx = pts[i + 1].x - pts[i - 1].x;
        dy = pts[i + 1].y - pts[i - 1].y;
      }
      let len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) { dx = 0; dy = 0; } else { dx /= len; dy /= len; }
      let perpX = -dy, perpY = dx;
      let width = this.whiteboard.calculateLineWidth(this.lineWidth, p.pressure);
      let offset = width / 2;
      left.push({ x: p.x + perpX * offset, y: p.y + perpY * offset });
      right.push({ x: p.x - perpX * offset, y: p.y - perpY * offset });
    }
    ctx.beginPath();
    if (left.length > 0) {
      ctx.moveTo(left[0].x, left[0].y);
      for (let i = 1; i < left.length; i++) {
        ctx.lineTo(left[i].x, left[i].y);
      }
      for (let i = right.length - 1; i >= 0; i--) {
        ctx.lineTo(right[i].x, right[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = this.color;
      ctx.fill();
    }
  }
}

class Whiteboard {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    // Default sizes and color.
    this.penLineWidth = 2;
    this.eraserLineWidth = 10;
    this.currentColor = '#000000';

    // Instantiate pen tools: round, flat, and brush.
    this.penTools = {
      round: new RoundPen(this),
      flat: new FlatPen(this),
      brush: new BrushPen(this)
    };
    // Default pen type.
    this.currentPenType = 'round';

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Current tool: 'pen', 'eraser', 'rect', or 'circle'
    this.currentTool = 'pen';
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.savedImage = null;

    this.bindEvents();

    // Load drawing if provided in URL.
    const params = new URLSearchParams(window.location.search);
    const drawingId = params.get('id');
    if (drawingId) {
      this.loadDrawing(drawingId);
    }
  }

  resize() {
    // Adjust canvas size (subtract sidebar width and top toolbar height).
    this.canvas.width = window.innerWidth - 150;
    this.canvas.height = window.innerHeight - 40;
    if (this.savedImage) {
      this.ctx.drawImage(this.savedImage, 0, 0);
    }
  }

  // Helper to compute effective line width based on pressure.
  calculateLineWidth(defaultWidth, pressure) {
    if (pressure === undefined || pressure < 0.1) return defaultWidth;
    return Math.max(defaultWidth * pressure, 1);
  }

  bindEvents() {
    // Use pointer events if available.
    if (window.PointerEvent) {
      this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
      this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
      this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
      this.canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    } else {
      this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
      this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
      this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
      this.canvas.addEventListener('mouseout', (e) => this.onMouseUp(e));
    }

    // Tool selection buttons for elements with data-tool.
    const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
    toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTool = btn.dataset.tool;
        toolButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Specific pen type buttons.
    document.getElementById('tool-pen').addEventListener('click', () => {
      this.currentTool = 'pen';
      this.currentPenType = 'round';
    });
    document.getElementById('tool-flat-pen').addEventListener('click', () => {
      this.currentTool = 'pen';
      this.currentPenType = 'flat';
      toolButtons.forEach(b => b.classList.remove('active'));
      document.getElementById('tool-flat-pen').classList.add('active');
    });
    document.getElementById('tool-brush-pen').addEventListener('click', () => {
      this.currentTool = 'pen';
      this.currentPenType = 'brush';
      toolButtons.forEach(b => b.classList.remove('active'));
      document.getElementById('tool-brush-pen').classList.add('active');
    });

    // Save drawing.
    document.getElementById('save').addEventListener('click', () => this.saveDrawing());

    // Eraser size popup.
    const lineWidthIcon = document.getElementById('lineWidthIcon');
    const lineWidthSelector = document.getElementById('lineWidthSelector');
    lineWidthIcon.addEventListener('click', () => {
      lineWidthSelector.style.display = (lineWidthSelector.style.display === 'block') ? 'none' : 'block';
    });
    document.getElementById('eraserWidth').addEventListener('input', (e) => {
      this.eraserLineWidth = parseInt(e.target.value, 10);
    });

    // Pen size popup.
    const penLineWidthIcon = document.getElementById('penLineWidthIcon');
    const penLineWidthSelector = document.getElementById('penLineWidthSelector');
    penLineWidthIcon.addEventListener('click', () => {
      penLineWidthSelector.style.display = (penLineWidthSelector.style.display === 'block') ? 'none' : 'block';
    });
    document.getElementById('penWidth').addEventListener('input', (e) => {
      this.penLineWidth = parseInt(e.target.value, 10);
    });

    // Color toolbar.
    const colorButtons = document.querySelectorAll('.color-btn');
    colorButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        colorButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentColor = btn.dataset.color;
        document.getElementById('colorPicker').value = btn.dataset.color;
      });
    });
    document.getElementById('colorPicker').addEventListener('input', (e) => {
      this.currentColor = e.target.value;
    });
  }

  onPointerDown(e) {
    e.preventDefault();
    e.target.setPointerCapture(e.pointerId);
    this.onMouseDown(e);
  }

  onPointerMove(e) {
    e.preventDefault();
    this.onMouseMove(e);
  }

  onPointerUp(e) {
    e.preventDefault();
    this.onMouseUp(e);
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  onMouseDown(e) {
    this.isDrawing = true;
    let pos = this.getMousePos(e);
    pos.pressure = (e.pressure !== undefined) ? e.pressure : 0.5;
    this.startX = pos.x;
    this.startY = pos.y;

    if (this.currentTool === 'pen') {
      let penTool = this.penTools[this.currentPenType];
      penTool.lineWidth = this.penLineWidth;
      penTool.color = this.currentColor;
      penTool.onMouseDown(pos);
    } else if (this.currentTool === 'eraser') {
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, pos.y);
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.lineWidth = this.eraserLineWidth;
    } else if (this.currentTool === 'rect' || this.currentTool === 'circle') {
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, pos.y);
      this.ctx.strokeStyle = this.currentColor;
    }
  }

  onMouseMove(e) {
    if (!this.isDrawing) return;
    let pos = this.getMousePos(e);
    pos.pressure = (e.pressure !== undefined) ? e.pressure : 0.5;

    if (this.currentTool === 'pen') {
      let penTool = this.penTools[this.currentPenType];
      penTool.onMouseMove(pos);
    } else if (this.currentTool === 'eraser') {
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();
    } else if (this.currentTool === 'rect' || this.currentTool === 'circle') {
      this.redrawPreview(pos);
    }
  }

  onMouseUp(e) {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    let pos = this.getMousePos(e);
    pos.pressure = (e.pressure !== undefined) ? e.pressure : 0.5;

    if (this.currentTool === 'pen') {
      let penTool = this.penTools[this.currentPenType];
      penTool.onMouseUp(pos);
      this.updateSavedImage();
    } else if (this.currentTool === 'eraser') {
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();
      this.updateSavedImage();
      this.ctx.globalCompositeOperation = 'source-over';
    } else if (this.currentTool === 'rect') {
      this.drawRect(this.startX, this.startY, pos.x - this.startX, pos.y - this.startY);
      this.updateSavedImage();
    } else if (this.currentTool === 'circle') {
      const radius = Math.sqrt(Math.pow(pos.x - this.startX, 2) + Math.pow(pos.y - this.startY, 2));
      this.drawCircle(this.startX, this.startY, radius);
      this.updateSavedImage();
    }
  }

  drawRect(x, y, w, h) {
    this.ctx.strokeRect(x, y, w, h);
  }

  drawCircle(x, y, radius) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  redrawPreview(pos) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.savedImage) {
      this.ctx.drawImage(this.savedImage, 0, 0);
    }
    const width = pos.x - this.startX;
    const height = pos.y - this.startY;
    this.ctx.save();
    this.ctx.strokeStyle = 'red';
    if (this.currentTool === 'rect') {
      this.ctx.strokeRect(this.startX, this.startY, width, height);
    } else if (this.currentTool === 'circle') {
      const radius = Math.sqrt(width * width + height * height);
      this.ctx.beginPath();
      this.ctx.arc(this.startX, this.startY, radius, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  updateSavedImage() {
    const dataURL = this.canvas.toDataURL();
    const img = new Image();
    img.src = dataURL;
    this.savedImage = img;
  }

  saveDrawing() {
    const dataURL = this.canvas.toDataURL();
    const drawing = {
      id: Date.now(),
      data: dataURL
    };
    let drawings = JSON.parse(localStorage.getItem('drawings')) || [];
    drawings.push(drawing);
    localStorage.setItem('drawings', JSON.stringify(drawings));
    alert('Drawing saved!');
  }

  loadDrawing(id) {
    let drawings = JSON.parse(localStorage.getItem('drawings')) || [];
    const drawing = drawings.find(d => d.id == id);
    if (drawing) {
      const img = new Image();
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0);
        this.savedImage = img;
      };
      img.src = drawing.data;
    } else {
      alert('Drawing not found!');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Whiteboard('whiteboard');
});
