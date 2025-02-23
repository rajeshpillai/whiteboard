// Base class for drawn elements.
class DrawingElement {
  draw(ctx) { }
  containsPoint(x, y) { return false; }
  move(dx, dy) { }
}

// A freehand stroke element.
class StrokeElement extends DrawingElement {
  constructor(points, color, lineWidth, penType) {
    super();
    this.points = points; // Array of {x, y, pressure?}
    this.color = color;
    this.lineWidth = lineWidth;
    this.penType = penType; // "round", "flat", or "brush"
  }
  draw(ctx) {
    if (this.points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth;
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    if (this.penType === "round") {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    } else if (this.penType === "flat") {
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
    }
    ctx.stroke();
    ctx.restore();
  }
  containsPoint(x, y) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.points.forEach(pt => {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    });
    const pad = 5;
    return (x >= minX - pad && x <= maxX + pad && y >= minY - pad && y <= maxY + pad);
  }
  move(dx, dy) {
    this.points = this.points.map(pt => ({
      x: pt.x + dx,
      y: pt.y + dy,
      pressure: pt.pressure
    }));
  }
}

// Rectangle element.
class RectElement extends DrawingElement {
  constructor(x, y, w, h, color) {
    super();
    this.x = x; this.y = y;
    this.w = w; this.h = h;
    this.color = color;
  }
  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.strokeRect(this.x, this.y, this.w, this.h);
    ctx.restore();
  }
  containsPoint(x, y) {
    return (x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h);
  }
  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }
}

// Circle element.
class CircleElement extends DrawingElement {
  constructor(x, y, radius, color) {
    super();
    this.x = x; this.y = y;
    this.radius = radius;
    this.color = color;
  }
  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  containsPoint(x, y) {
    let dx = x - this.x, dy = y - this.y;
    return Math.sqrt(dx * dx + dy * dy) <= this.radius;
  }
  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }
}

class Whiteboard {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    // We'll assume the canvas is wrapped in a container with id "canvas-container".
    this.container = document.getElementById('canvas-container');

    // Array to hold finished drawing elements.
    this.elements = [];
    // The element currently being drawn.
    this.currentElement = null;
    // The element selected in select mode.
    this.selectedElement = null;
    // Variables to track dragging in select mode.
    this.isDraggingSelected = false;
    this.lastMousePos = null;
    this.selectionOffset = { dx: 0, dy: 0 };

    // Variables for pan mode.
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.initialScrollLeft = 0;
    this.initialScrollTop = 0;

    // Default drawing settings.
    this.penLineWidth = 2;
    this.eraserLineWidth = 10;
    this.currentColor = '#000000';

    // Tools: "pen", "rect", "circle", "eraser", "select", "pan"
    // For pen, currentPenType can be "round", "flat", or "brush"
    this.currentTool = "pen";
    this.currentPenType = "round"; // default

    // Set a large fixed canvas size in CSS; do not change it on window resize.
    // (The CSS sets #whiteboard { width: 3000px; height: 3000px; } )
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    this.bindEvents();
    this.redraw();
    
    // Optionally load drawing via URL parameters.
    const params = new URLSearchParams(window.location.search);
    const drawingId = params.get('id');
    if (drawingId) {
      this.loadDrawing(drawingId);
    }
  }
  
  resize() {
    // Since the canvas is set in CSS to a large fixed size, do not reset its width/height.
    this.redraw();
  }
  
  // Redraw all elements.
  redraw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.elements.forEach(el => el.draw(this.ctx));
    if (this.currentElement) {
      this.currentElement.draw(this.ctx);
    }
    if (this.selectedElement) {
      this.ctx.save();
      this.ctx.strokeStyle = 'blue';
      this.ctx.lineWidth = 2;
      let bb = this.getBoundingBox(this.selectedElement);
      this.ctx.strokeRect(bb.x, bb.y, bb.w, bb.h);
      this.ctx.restore();
    }
  }
  
  // Returns a simple bounding box for an element.
  getBoundingBox(el) {
    if (el instanceof StrokeElement) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      el.points.forEach(pt => {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      });
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    } else if (el instanceof RectElement) {
      return { x: el.x, y: el.y, w: el.w, h: el.h };
    } else if (el instanceof CircleElement) {
      return { x: el.x - el.radius, y: el.y - el.radius, w: el.radius * 2, h: el.radius * 2 };
    }
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  
  // Reset the board for a new drawing.
  newDrawing() {
    this.elements = [];
    this.currentElement = null;
    this.selectedElement = null;
    this.redraw();
  }
  
  // Delete the currently selected element.
  deleteSelected() {
    if (this.selectedElement) {
      this.elements = this.elements.filter(el => el !== this.selectedElement);
      this.selectedElement = null;
      this.redraw();
    } else {
      alert("No element selected for deletion.");
    }
  }
  
  // Save the current drawing (vector data and preview) to localStorage.
  saveDrawing() {
    let serialized = this.elements.map(el => {
      if (el instanceof StrokeElement) {
        return { type: 'stroke', points: el.points, color: el.color, lineWidth: el.lineWidth, penType: el.penType };
      } else if (el instanceof RectElement) {
        return { type: 'rect', x: el.x, y: el.y, w: el.w, h: el.h, color: el.color };
      } else if (el instanceof CircleElement) {
        return { type: 'circle', x: el.x, y: el.y, radius: el.radius, color: el.color };
      }
    });
    let preview = this.canvas.toDataURL();
    let drawing = {
      id: Date.now(),
      data: serialized,
      preview: preview
    };
    let drawings = JSON.parse(localStorage.getItem('drawings')) || [];
    drawings.push(drawing);
    localStorage.setItem('drawings', JSON.stringify(drawings));
    alert('Drawing saved!');
  }
  
  // Load a drawing by id from localStorage.
  loadDrawing(id) {
    let drawings = JSON.parse(localStorage.getItem('drawings')) || [];
    let drawing = drawings.find(d => d.id == id);
    if (drawing) {
      this.elements = drawing.data.map(item => {
        if (item.type === 'stroke') {
          return new StrokeElement(item.points, item.color, item.lineWidth, item.penType);
        } else if (item.type === 'rect') {
          return new RectElement(item.x, item.y, item.w, item.h, item.color);
        } else if (item.type === 'circle') {
          return new CircleElement(item.x, item.y, item.radius, item.color);
        }
      });
      this.redraw();
      alert('Drawing loaded!');
    } else {
      alert('Drawing not found!');
    }
  }
  
  bindEvents() {
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
    
    // Bind only tool buttons that have a data-tool attribute.
    const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
    toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTool = btn.dataset.tool;
        if (this.currentTool === "select" || this.currentTool === "pan") {
          this.canvas.style.cursor = "move";
        } else {
          this.canvas.style.cursor = "crosshair";
        }
        if (btn.id === 'tool-pen') {
          this.currentPenType = "round";
        } else if (btn.id === 'tool-flat-pen') {
          this.currentPenType = "flat";
        } else if (btn.id === 'tool-brush-pen') {
          this.currentPenType = "brush";
        }
        // Clear selection when switching tools.
        this.selectedElement = null;
        toolButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.redraw();
      });
    });
    
    // Bind the New Drawing button.
    document.getElementById('newDrawing').addEventListener('click', () => {
      if (confirm("Start a new drawing? Your current drawing will be lost.")) {
        this.newDrawing();
      }
    });
    
    // Bind the Delete button.
    document.getElementById('delete').addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteSelected();
    });
    
    // Bind keyboard delete.
    document.addEventListener('keydown', (e) => {
      if (e.key === "Delete" && this.selectedElement) {
        this.deleteSelected();
      }
    });
    
    // Settings popovers.
    document.getElementById('penLineWidthIcon').addEventListener('click', () => {
      let sel = document.getElementById('penLineWidthSelector');
      sel.style.display = (sel.style.display === 'block') ? 'none' : 'block';
    });
    document.getElementById('penWidth').addEventListener('input', (e) => {
      this.penLineWidth = parseInt(e.target.value, 10);
    });
    document.getElementById('lineWidthIcon').addEventListener('click', () => {
      let sel = document.getElementById('lineWidthSelector');
      sel.style.display = (sel.style.display === 'block') ? 'none' : 'block';
    });
    document.getElementById('eraserWidth').addEventListener('input', (e) => {
      this.eraserLineWidth = parseInt(e.target.value, 10);
    });
    
    // Color toolbar.
    const colorButtons = document.querySelectorAll('.color-btn');
    colorButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        colorButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentColor = btn.dataset.color;
        document.getElementById('colorPicker').value = btn.dataset.color;
        this.redraw();
      });
    });
    document.getElementById('colorPicker').addEventListener('input', (e) => {
      this.currentColor = e.target.value;
      this.redraw();
    });
    
    // Save button.
    document.getElementById('save').addEventListener('click', () => this.saveDrawing());
    
    // Bind Pan tool events (Pan tool button should have data-tool="pan").
    // (The generic tool buttons binding above will set this.currentTool to "pan" when clicked.)
  }
  
  // Pointer event wrappers.
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
    const containerRect = this.container.getBoundingClientRect();
    return {
      x: e.clientX - containerRect.left + this.container.scrollLeft,
      y: e.clientY - containerRect.top + this.container.scrollTop,
      pressure: (e.pressure !== undefined && e.pressure > 0) ? e.pressure : 1
    };
  }
  
  
  onMouseDown(e) {
    let pos = this.getMousePos(e);
    if (this.currentTool === "select") {
      for (let i = this.elements.length - 1; i >= 0; i--) {
        if (this.elements[i].containsPoint(pos.x, pos.y)) {
          this.selectedElement = this.elements[i];
          this.lastMousePos = pos;
          this.isDraggingSelected = true;
          break;
        }
      }
    } else if (this.currentTool === "pan") {
      this.isPanning = true;
      this.panStart = { x: pos.x, y: pos.y };
      this.initialScrollLeft = this.container.scrollLeft;
      this.initialScrollTop = this.container.scrollTop;
    } else if (this.currentTool === "pen" || this.currentTool === "eraser") {
      let col = (this.currentTool === "eraser") ? "#fff" : this.currentColor;
      let lw = (this.currentTool === "eraser") ? this.eraserLineWidth : this.penLineWidth;
      this.currentElement = new StrokeElement([], col, lw, this.currentPenType);
      this.currentElement.points.push(pos);
    } else if (this.currentTool === "rect") {
      this.currentElement = new RectElement(pos.x, pos.y, 0, 0, this.currentColor);
    } else if (this.currentTool === "circle") {
      this.currentElement = new CircleElement(pos.x, pos.y, 0, this.currentColor);
    }
    this.redraw();
  }
  
  onMouseMove(e) {
    let pos = this.getMousePos(e);
    if (this.currentTool === "select" && this.selectedElement && this.isDraggingSelected) {
      let dx = pos.x - this.lastMousePos.x;
      let dy = pos.y - this.lastMousePos.y;
      this.selectedElement.move(dx, dy);
      this.lastMousePos = pos;
      this.redraw();
    } else if (this.currentTool === "pan" && this.isPanning) {
      let dx = pos.x - this.panStart.x;
      let dy = pos.y - this.panStart.y;
      this.container.scrollLeft = this.initialScrollLeft - dx;
      this.container.scrollTop = this.initialScrollTop - dy;
    } else if (this.currentElement) {
      if (this.currentTool === "pen" || this.currentTool === "eraser") {
        this.currentElement.points.push(pos);
      } else if (this.currentTool === "rect") {
        this.currentElement.w = pos.x - this.currentElement.x;
        this.currentElement.h = pos.y - this.currentElement.y;
      } else if (this.currentTool === "circle") {
        let dx = pos.x - this.currentElement.x;
        let dy = pos.y - this.currentElement.y;
        this.currentElement.radius = Math.sqrt(dx * dx + dy * dy);
      }
      this.redraw();
    }
  }
  
  onMouseUp(e) {
    if (this.currentTool === "select") {
      this.isDraggingSelected = false;
    } else if (this.currentTool === "pan") {
      this.isPanning = false;
    } else if (this.currentElement) {
      if (this.currentTool === "pen" || this.currentTool === "eraser" ||
          this.currentTool === "rect" || this.currentTool === "circle") {
        this.elements.push(this.currentElement);
      }
      this.currentElement = null;
      this.redraw();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Whiteboard('whiteboard');
});
