// Base class for drawn elements.
class DrawingElement {
  draw(ctx) { }
  
  containsPoint(x, y) { return false; }
  
  move(dx, dy) { }
  
  hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    let bigint = parseInt(hex, 16);
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;
    return `${r},${g},${b}`;
  }

}

class StrokeElement extends DrawingElement {
  constructor(points, color, lineWidth, penType, smoothingEnabled = false, smoothingFactor = 0.6) {
    super();
    this.points = points || [];
    this.smoothedPoints = [];
    this.color = color;
    this.lineWidth = lineWidth;
    this.penType = penType || "round";
    this.opacityCache = {}; 
    this.smoothingEnabled = smoothingEnabled; // ✅ Toggle smoothing
    this.smoothingFactor = smoothingFactor; // ✅ Adjust via slider
  }

  draw(ctx) {
    if (this.points.length < 2) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();

    // ✅ Apply smoothing only for brush if enabled
    let interpolatedPoints = (this.penType === "brush" && this.smoothingEnabled)
        ? this.getSmoothStroke() 
        : this.points;

    ctx.moveTo(interpolatedPoints[0].x, interpolatedPoints[0].y);

    for (let i = 1; i < interpolatedPoints.length - 1; i++) {
      let p0 = interpolatedPoints[i - 1];
      let p1 = interpolatedPoints[i];
      let p2 = interpolatedPoints[i + 1];

      let xc2 = (p1.x + p2.x) / 2;
      let yc2 = (p1.y + p2.y) / 2;

      if (this.penType === "brush") {
        let width = this.lineWidth * (p1.pressure || 1);
        let opacity = Math.min(1, 0.3 + (p1.pressure || 1) * 0.7);

        let cacheKey = `${this.color}-${width}-${opacity}`;
        if (!this.opacityCache[cacheKey]) {
          this.opacityCache[cacheKey] = `rgba(${this.hexToRgb(this.color)}, ${opacity})`;
        }

        ctx.lineWidth = Math.max(1, width);
        ctx.strokeStyle = this.opacityCache[cacheKey];
      } else {
        ctx.lineWidth = this.lineWidth;
        ctx.strokeStyle = this.color;
      }

      // ✅ Apply Bézier curves only when smoothing is enabled
      ctx.quadraticCurveTo(p1.x, p1.y, xc2, yc2);
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * ✅ Uses Catmull-Rom spline-like smoothing based on cubic Bézier interpolation.
   * ✅ Only applies smoothing if `this.smoothingEnabled` is true.
   * ✅ Smoothness is controlled dynamically by the user.
   */
  getSmoothStroke() {
    if (!this.smoothingEnabled || this.points.length < 3) return this.points;

    let smoothed = [];
    smoothed.push(this.points[0]);

    for (let i = 1; i < this.points.length - 1; i++) {
      let prev = this.points[i - 1];
      let curr = this.points[i];
      let next = this.points[i + 1];

      let xc1 = (prev.x + curr.x) / 2;
      let yc1 = (prev.y + curr.y) / 2;
      let xc2 = (curr.x + next.x) / 2;
      let yc2 = (curr.y + next.y) / 2;

      // ✅ Adjust smoothing factor dynamically
      let smoothX = curr.x * this.smoothingFactor + xc2 * (1 - this.smoothingFactor);
      let smoothY = curr.y * this.smoothingFactor + yc2 * (1 - this.smoothingFactor);

      smoothed.push({ x: smoothX, y: smoothY, pressure: curr.pressure });
    }

    smoothed.push(this.points[this.points.length - 1]);
    return smoothed;
  }

  /**
   * ✅ Updates smoothness dynamically when slider changes.
   */
  updateSmoothness(smoothFactor) {
    this.smoothingFactor = smoothFactor;
  }

  /**
   * ✅ Reduces the number of stored points to keep performance high.
   */
  simplify() {
    if (this.points.length > 500) {
      this.points = this.points.filter((_, i) => i % 2 === 0);
    }
  }

  /**
   * ✅ Adds points intelligently with adaptive smoothing.
   */
  addPoint(pos) {
    if (this.points.length > 0) {
      const prevPoint = this.points[this.points.length - 1];
      let dx = pos.x - prevPoint.x;
      let dy = pos.y - prevPoint.y;
      let distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 2) return; // ✅ Avoid jittery small movements
    }

    this.points.push(pos);
  }

  /**
   * ✅ Updates color dynamically while drawing.
   */
  updateColor(newColor) {
    this.color = newColor;
    this.opacityCache = {}; 
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

    this.smoothingFactor = 0.5; // Default smoothness
    this.smoothingEnabled = false;

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
  
    // ✅ Only redraw visible strokes to improve performance
    for (let i = Math.max(0, this.elements.length - 500); i < this.elements.length; i++) {
      this.elements[i].draw(this.ctx);
    }

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

  colorToHex(color) {
    let ctx = document.createElement("canvas").getContext("2d");
    ctx.fillStyle = color;
    return ctx.fillStyle; // ✅ Converts named colors to hex
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
      this.smoothingFactor = parseFloat(e.target.value);
      document.getElementById('smoothnessValue').textContent = this.smoothingFactor;
        // ✅ Apply smoothness dynamically to active stroke
      if (this.currentElement instanceof StrokeElement && this.currentPenType === "brush") {
          this.currentElement.updateSmoothness(this.smoothingFactor);
      }

    });
  

    // Modify click event on the canvas
    this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

    
    // Bind only tool buttons that have a data-tool attribute.
    const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
    toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // ✅ Reset the current drawing element when switching tools
        if (this.currentPenType === "brush" && this.currentElement) {
          console.log("Saving brush stroke before switching...");
          this.elements.push(this.currentElement); // ✅ Save the last brush stroke
          this.currentElement = null; // ✅ Reset the brush stroke AFTER saving
          this.redraw();
        }

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
        this.selectedElements = [];

        // Highlight the selected tool
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
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
      document.getElementById('penWidthValue').textContent = this.lineWidth; // ✅ Update UI
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
        this.currentColor = this.colorToHex(btn.dataset.color);
        document.getElementById('colorPicker').value = this.currentColor;
        this.redraw();
      });
    });
    document.getElementById('colorPicker').addEventListener('input', (e) => {
      this.currentColor = e.target.value;

      // ✅ If the current tool is brush, update its color in real-time
      if (this.currentElement instanceof StrokeElement && this.currentPenType === "brush") {
        this.currentElement.updateColor(this.currentColor);
      }

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
        // console.log(`clickedInside: ${clickedInside}`);
        if (clickedInside) {
            this.isDraggingMultiple = false; // Start dragging
            this.lastMousePos = pos;
        } else {
            // console.log("setting selectedElements to empty!!!");
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
    // console.log(`currentTool: ${this.currentTool}`, pos);
    if (this.currentTool === "select-rect") {
        // Start drawing the selection rectangle
        this.isSelecting = true;
        this.selectionRect = { x: pos.x, y: pos.y, w: 0, h: 0 };
    } else if (this.currentTool === "select") {
        // Check if clicking inside selected elements
        let clickedInside = this.selectedElements.some(el => el.containsPoint(pos.x, pos.y));
        // console.log(`clickedInside: ${clickedInside}`);
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

            // console.log(this.selectedElement, this.isDraggingSelected);

        }
    } else if (this.currentTool === "pen" || this.currentTool === "eraser") {
        let col = this.currentTool === "eraser" ? "#fff" : this.currentColor;
        let lw = this.currentTool === "eraser" ? this.eraserLineWidth : this.penLineWidth;
        this.currentElement = new StrokeElement([], col, lw, this.currentPenType, this.smoothingEnabled, this.smoothingFactor);
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

    if (!this.needsRedraw) {
        this.needsRedraw = true;
        requestAnimationFrame(() => {
            this.redraw();
            this.needsRedraw = false;
        });
    }

    console.log("Smoothing: ", this.smoothingEnabled);
    console.log("# of Elems: ", this.elements.length);
    console.log("# of points in current elem: ", this.currentElement?.points);

    if (this.currentTool === "pen" && this.currentPenType === "brush") {
      if (!this.currentElement) return;
      pos.pressure = e.pressure !== undefined && this.pressureEnabled ? e.pressure : 1;
      this.currentElement.addPoint(pos, this.currentColor);
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
  }

  
  onMouseUp(e) {
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

        // ✅ Ensure brush strokes are also saved
        if (this.currentTool === "pen" && this.currentPenType === "brush") {
          console.log("Saving brush stroke...");
          this.elements.push(this.currentElement);

          // ✅ Limit stored brush strokes to the last 1000 to prevent lag
          if (this.elements.length > 1000) {
            this.elements = this.elements.slice(-1000);
          }
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
