// Base class for tools
class Tool {
  constructor(whiteboard) {
    this.whiteboard = whiteboard;
  }
  onMouseDown(pos) {}
  onMouseMove(pos) {}
  onMouseUp(pos) {}
}

// A RoundPen tool – draws with round line caps.
class RoundPen extends Tool {
  constructor(whiteboard) {
    super(whiteboard);
    // Default properties will be updated from the whiteboard state on each stroke.
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
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }
  onMouseUp(pos) {
    // Optional: finalize the stroke if needed.
  }
}

// A FlatPen tool – draws with flat (butt) caps and sharp (miter) joins.
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
    // Use flat stroke settings:
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
  }
  onMouseMove(pos) {
    const ctx = this.whiteboard.ctx;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }
  onMouseUp(pos) {
    // Nothing extra needed.
  }
}

class Whiteboard {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    // Set smoothing properties for non-tool-specific drawing.
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Default sizes and colors.
    this.penLineWidth = 2;       // default pen size
    this.eraserLineWidth = 10;   // default eraser size
    this.currentColor = '#000000'; // default drawing color

    // Instantiate available pen types.
    // You now have both a "round" and a "flat" pen.
    this.penTools = {
      round: new RoundPen(this),
      flat: new FlatPen(this)
    };
    // Default pen tool can remain "round", or you could change to "flat".
    this.currentPenType = 'round';

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // currentTool can be: 'pen', 'eraser', 'rect', or 'circle'
    this.currentTool = 'pen';
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.savedImage = null;

    this.bindEvents();

    // Check if a drawing is loaded from URL.
    const params = new URLSearchParams(window.location.search);
    const drawingId = params.get('id');
    if (drawingId) {
      this.loadDrawing(drawingId);
    }
  }

  resize() {
    // Adjust canvas size; subtract sidebar width and top toolbar height.
    this.canvas.width = window.innerWidth - 150;
    this.canvas.height = window.innerHeight - 40;
    if (this.savedImage) {
      this.ctx.drawImage(this.savedImage, 0, 0);
    }
  }

  bindEvents() {
    // Use pointer events if supported.
    if (window.PointerEvent) {
      this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
      this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
      this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
      this.canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    } else {
      // Fallback to mouse events.
      this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
      this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
      this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
      this.canvas.addEventListener('mouseout', (e) => this.onMouseUp(e));
    }

    // Tool selection buttons (for non-pen tools)
    const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
    toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTool = btn.dataset.tool;
        toolButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Specifically for pen type selection:
    document.getElementById('tool-pen').addEventListener('click', () => {
      this.currentTool = 'pen';
      this.currentPenType = 'round';
    });
    document.getElementById('tool-flat-pen').addEventListener('click', () => {
      this.currentTool = 'pen';
      this.currentPenType = 'flat';
      // Optionally update active states if you want to visually differentiate
      // between round and flat pen selection.
      toolButtons.forEach(b => b.classList.remove('active'));
      document.getElementById('tool-flat-pen').classList.add('active');
    });

    // Save drawing button.
    document.getElementById('save').addEventListener('click', () => this.saveDrawing());

    // Handle eraser size selection popup.
    const lineWidthIcon = document.getElementById('lineWidthIcon');
    const lineWidthSelector = document.getElementById('lineWidthSelector');
    lineWidthIcon.addEventListener('click', () => {
      lineWidthSelector.style.display = (lineWidthSelector.style.display === 'block') ? 'none' : 'block';
    });
    document.getElementById('eraserWidth').addEventListener('input', (e) => {
      this.eraserLineWidth = parseInt(e.target.value, 10);
    });

    // Handle pen size selection popup.
    const penLineWidthIcon = document.getElementById('penLineWidthIcon');
    const penLineWidthSelector = document.getElementById('penLineWidthSelector');
    penLineWidthIcon.addEventListener('click', () => {
      penLineWidthSelector.style.display = (penLineWidthSelector.style.display === 'block') ? 'none' : 'block';
    });
    document.getElementById('penWidth').addEventListener('input', (e) => {
      this.penLineWidth = parseInt(e.target.value, 10);
    });

   // Handle color toolbar buttons.
    const colorButtons = document.querySelectorAll('.color-btn');
    colorButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Remove active class from all color buttons.
        colorButtons.forEach(b => b.classList.remove('active'));
        // Add active class to the clicked button.
        btn.classList.add('active');
        // Update the current drawing color.
        this.currentColor = btn.dataset.color;
        // Update the color picker's value.
        document.getElementById('colorPicker').value = btn.dataset.color;
      });
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
    const pos = this.getMousePos(e);
    this.startX = pos.x;
    this.startY = pos.y;

    if (this.currentTool === 'pen') {
      // Delegate to the selected pen tool.
      let penTool = this.penTools[this.currentPenType];
      // Update pen tool properties from the whiteboard state.
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
    const pos = this.getMousePos(e);
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
    const pos = this.getMousePos(e);
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
