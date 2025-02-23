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
    
    ctx.lineCap = this.penType === "round" ? "round" : "butt";
    ctx.lineJoin = this.penType === "rount" ? "round" : "miter";

    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);

    if (this.penType === "brush" && this.points.length > 3) {
        for (let i = 1; i < this.points.length - 2; i++) {
            let p0 = this.points[i - 1];
            let p1 = this.points[i];
            let p2 = this.points[i + 1];

            let width = this.lineWidth;
            if (this.pressureEnabled) {
                width *= p1.pressure || 1; // Scale line width based on pressure
            }

            ctx.lineWidth = Math.max(1, width); // Ensure minimum width

            let xc1 = (p0.x + p1.x) / 2;
            let yc1 = (p0.y + p1.y) / 2;
            let xc2 = (p1.x + p2.x) / 2;
            let yc2 = (p1.y + p2.y) / 2;

            ctx.quadraticCurveTo(p1.x, p1.y, xc2, yc2);
        }
    } else {
      // Default straight-line drawing for other pen types
      ctx.lineWidth = this.lineWidth;
      for (let i = 1; i < this.points.length; i++) {
          ctx.lineTo(this.points[i].x, this.points[i].y);
      }
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

    // Select region
    this.isSelecting = false;  // Whether we are in selection mode
    this.selectionRect = null;  // Stores the selection rectangle coordinates
    this.selectedElements = []; // Stores multiple selected elements


    // Default drawing settings.
    this.penLineWidth = 2;
    this.eraserLineWidth = 10;
    this.currentColor = '#000000';

    // Tools: "pen", "rect", "circle", "eraser", "select", "pan"
    // For pen, currentPenType can be "round", "flat", or "brush"
    this.currentTool = "pen";
    this.currentPenType = "round"; // default

    this.brushSmoothness = 0.5; // Default smoothness
    this.smoothingEnabled = true;

    this.pressureEnabled = false; // Default: ON


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

    // Draw the currently active element (so we see drawing as we move the mouse)
    if (this.currentElement) {
        this.currentElement.draw(this.ctx);
    }

    // Draw selection rectangle (if selecting)
    if (this.isSelecting && this.selectionRect) {
        this.ctx.save();
        this.ctx.strokeStyle = 'blue';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]); // Dashed lines
        this.ctx.strokeRect(this.selectionRect.x, this.selectionRect.y, this.selectionRect.w, this.selectionRect.h);
        this.ctx.restore();
    }

    // Highlight selected elements
    this.selectedElements.forEach(el => {
        this.ctx.save();
        this.ctx.strokeStyle = 'blue';
        this.ctx.lineWidth = 2;
        let bb = this.getBoundingBox(el);
        this.ctx.strokeRect(bb.x, bb.y, bb.w, bb.h);
        this.ctx.restore();
    });
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
    if (this.selectedElements.length > 0) {
        this.elements = this.elements.filter(el => !this.selectedElements.includes(el));
        this.selectedElements = [];
    } else if (this.selectedElement) {
        this.elements = this.elements.filter(el => el !== this.selectedElement);
        this.selectedElement = null;
    } else {
        alert("No elements selected.");
    }
    this.redraw();
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

    document.getElementById('smoothToggle').addEventListener('change', (e) => {
      this.smoothingEnabled = e.target.checked;
    });
  
    document.getElementById('smoothness').addEventListener('input', (e) => {
      this.brushSmoothness = parseFloat(e.target.value);
      document.getElementById('smoothnessValue').textContent = this.brushSmoothness;
    });
  

    // Modify click event on the canvas
    this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

    
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
      if (e.key === "Delete" && (this.selectedElement || this.selectedElements.length > 0)) {
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

  // Reset
  handleCanvasClick(e) {
    let pos = this.getMousePos(e);

    console.log(`Canvas click:  
                  tool: ${this.currentTool}, 
                  isSelecting: ${this.isSelecting}, 
                  selectionRect: ${this.selectionRect}, 
                  isDraggingMultiple: ${this.isDraggingMultiple},
                  selectedElements: ${this.selectedElements.length}`
                );

    if (this.selectedElements.length > 0) {  // Check if anything is selected
        let clickedInside = this.selectedElements.some(el => el.containsPoint(pos.x, pos.y));
        console.log(`clickedInside: ${clickedInside}`);
        if (clickedInside) {
            this.isDraggingMultiple = false; // Start dragging
            this.lastMousePos = pos;
        } else {
            console.log("setting selectedElements to empty!!!");
            if (this.currentTool == "select") {
              this.selectedElements = []; // Clear selection
            }
            this.redraw();
        }
    }
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
    console.log(`currentTool: ${this.currentTool}`);
    if (this.currentTool === "select-rect") {
        // Start drawing the selection rectangle
        this.isSelecting = true;
        this.selectionRect = { x: pos.x, y: pos.y, w: 0, h: 0 };
    } else if (this.currentTool === "select") {
        // Check if clicking inside selected elements
        let clickedInside = this.selectedElements.some(el => el.containsPoint(pos.x, pos.y));
        console.log(`clickedInside: ${clickedInside}`);
        if (clickedInside) {
            this.isDraggingMultiple = true;
            this.lastMousePos = pos;
        } else {
            // If clicked outside, clear selection
            // this.selectedElements = [];
            // this.redraw();

            // TODO:
            console.log("Single selection check...");
            for (let i = this.elements.length - 1; i >= 0; i--) {
              if (this.elements[i].containsPoint(pos.x, pos.y)) {
                this.selectedElement = this.elements[i];
                this.lastMousePos = pos;
                this.isDraggingSelected = true;
                break;
              }
            }

            console.log(this.selectedElement, this.isDraggingSelected);

        }
    } else if (this.currentTool === "pen" || this.currentTool === "eraser") {
        let col = this.currentTool === "eraser" ? "#fff" : this.currentColor;
        let lw = this.currentTool === "eraser" ? this.eraserLineWidth : this.penLineWidth;
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

    console.log(`tool: ${this.currentTool}, isSelecting: ${this.isSelecting}, selectionRect: ${this.selectionRect}, isDraggingMultiple: ${this.isDraggingMultiple}`);

    if (this.currentTool === "pen" && this.currentPenType === "brush") {
      if (!this.currentElement) return;

      const now = Date.now();
      const prevPoint = this.currentElement.points[this.currentElement.points.length - 1];

      if (prevPoint && this.smoothingEnabled) {
          let dx = pos.x - prevPoint.x;
          let dy = pos.y - prevPoint.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          let dt = now - prevPoint.time;
          let speed = dist / (dt || 1); // Avoid division by zero

          // Weighted moving average (reduce jitter)
          const alpha = this.brushSmoothness;
          pos.x = alpha * prevPoint.x + (1 - alpha) * pos.x;
          pos.y = alpha * prevPoint.y + (1 - alpha) * pos.y;

          // Speed-based smoothing
          const minSmooth = 0.2 * this.brushSmoothness;
          const maxSmooth = 0.9 * this.brushSmoothness;
          const speedFactor = Math.max(minSmooth, Math.min(maxSmooth, 1 - speed * 0.01));

          pos.x = prevPoint.x * speedFactor + pos.x * (1 - speedFactor);
          pos.y = prevPoint.y * speedFactor + pos.y * (1 - speedFactor);
      }

      pos.time = now;
      pos.pressure = e.pressure !== undefined && this.pressureEnabled ? e.pressure : 1; // Apply pressure only if enabled
      this.currentElement.points.push(pos);
   }


    if (this.currentTool === "eraser") {
      this.elements = this.elements.map(el => {
          if (el instanceof StrokeElement) {
              el.points = el.points.filter(pt => 
                  Math.sqrt((pt.x - pos.x) ** 2 + (pt.y - pos.y) ** 2) > this.eraserLineWidth
              );
              return el;
          }
          return el;
      }).filter(el => el.points.length > 1);  // Remove strokes with no points
    }
    if (this.currentTool === "select" && this.selectedElement && this.isDraggingSelected) {
      let dx = pos.x - this.lastMousePos.x;
      let dy = pos.y - this.lastMousePos.y;
      this.selectedElement.move(dx, dy);
      this.lastMousePos = pos;
      this.redraw();
    } else if (this.isSelecting && this.selectionRect) {
        // Update the selection rectangle size
        this.selectionRect.w = pos.x - this.selectionRect.x;
        this.selectionRect.h = pos.y - this.selectionRect.y;
    } else if (this.isDraggingMultiple) {
        // Move all selected elements together
        let dx = pos.x - this.lastMousePos.x;
        let dy = pos.y - this.lastMousePos.y;
        this.selectedElements.forEach(el => el.move(dx, dy));
        this.lastMousePos = pos;
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
    }
    this.redraw();
  }
  
  onMouseUp(e) {
    // TODO; 
    if (this.currentTool === "select") {
      this.isDraggingSelected = false;
      this.isDraggingMultiple = false;
    } else if (this.isSelecting) {
        // Find elements inside the selection rectangle
        this.selectedElements = this.elements.filter(el => this.isInsideSelection(el, this.selectionRect));
        this.isSelecting = false;
        this.isDraggingMultiple = false;
    } else if (this.isDraggingMultiple) {
        this.isDraggingMultiple = false;
    } else if (this.currentElement) {
        if (this.currentTool === "pen" || this.currentTool === "eraser" ||
            this.currentTool === "rect" || this.currentTool === "circle") {
            this.elements.push(this.currentElement);
        }
        this.currentElement = null;
    }
    this.redraw();
  }


  isInsideSelection(el, rect) {
    let bb = this.getBoundingBox(el);
    return (
        bb.x >= rect.x && 
        bb.y >= rect.y &&
        bb.x + bb.w <= rect.x + rect.w &&
        bb.y + bb.h <= rect.y + rect.h
    );
  }
}



document.addEventListener('DOMContentLoaded', () => {
  new Whiteboard('whiteboard');
});
