class Whiteboard {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    // Set smoothing properties for better line quality
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.lineWidth = 2; // adjust as needed

    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.currentTool = 'pen';
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.savedImage = null;

    this.bindEvents();

    const params = new URLSearchParams(window.location.search);
    const drawingId = params.get('id');
    if (drawingId) {
      this.loadDrawing(drawingId);
    }
  }

  // Ensure the resize method is defined
  resize() {
    // Adjust canvas size (subtract sidebar width)
    this.canvas.width = window.innerWidth - 150;
    this.canvas.height = window.innerHeight;
    // Redraw saved image if available
    if (this.savedImage) {
      this.ctx.drawImage(this.savedImage, 0, 0);
    }
  }

  bindEvents() {
    // Use pointer events if supported
    if (window.PointerEvent) {
      this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
      this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
      this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
      this.canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    } else {
      // Fallback to mouse events
      this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
      this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
      this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
      this.canvas.addEventListener('mouseout', (e) => this.onMouseUp(e));
    }

    // Tool selection
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTool = btn.dataset.tool;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    document.getElementById('save').addEventListener('click', () => this.saveDrawing());
  }

  onPointerDown(e) {
    e.preventDefault();
    // Capture the pointer to ensure smooth continuous drawing
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
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, pos.y);
    }
  }

  onMouseMove(e) {
    if (!this.isDrawing) return;
    const pos = this.getMousePos(e);

    if (this.currentTool === 'pen') {
      this.drawLine(pos.x, pos.y);
    } else if (this.currentTool === 'rect' || this.currentTool === 'circle') {
      this.redrawPreview(pos);
    }
  }

  onMouseUp(e) {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    const pos = this.getMousePos(e);

    if (this.currentTool === 'rect') {
      this.drawRect(this.startX, this.startY, pos.x - this.startX, pos.y - this.startY);
      this.updateSavedImage();
    } else if (this.currentTool === 'circle') {
      const radius = Math.sqrt(Math.pow(pos.x - this.startX, 2) + Math.pow(pos.y - this.startY, 2));
      this.drawCircle(this.startX, this.startY, radius);
      this.updateSavedImage();
    } else if (this.currentTool === 'pen') {
      this.updateSavedImage();
    }
  }

  drawLine(x, y) {
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
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
