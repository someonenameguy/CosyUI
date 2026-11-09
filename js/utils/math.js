/**
 * CosyUI - Math & Geometry Utilities
 * High performance matrix transformations, Bézier calculations, and AABB math.
 */

export const MathUtils = {
  /**
   * Convert Screen coordinate to Canvas World coordinate
   */
  screenToWorld(screenX, screenY, panX, panY, zoom) {
    return {
      x: (screenX - panX) / zoom,
      y: (screenY - panY) / zoom
    };
  },

  /**
   * Convert Canvas World coordinate to Screen coordinate
   */
  worldToScreen(worldX, worldY, panX, panY, zoom) {
    return {
      x: worldX * zoom + panX,
      y: worldY * zoom + panY
    };
  },

  /**
   * Clamp value between min and max
   */
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  /**
   * Euclidean distance between two points
   */
  distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.hypot(dx, dy);
  },

  /**
   * Snap coordinate to grid
   */
  snapToGrid(value, gridSize = 16) {
    return Math.round(value / gridSize) * gridSize;
  },

  /**
   * Calculate SVG cubic Bézier path string between two ports
   */
  calculateCubicBezier(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    
    // Calculate adaptive horizontal curvature offset
    let offset = Math.max(dx * 0.45, 40);
    if (x2 < x1) {
      // Loopback curve when target is behind source
      offset = Math.max((x1 - x2) * 0.7, dy * 0.4, 60);
    }

    const cx1 = x1 + offset;
    const cy1 = y1;
    const cx2 = x2 - offset;
    const cy2 = y2;

    return {
      path: `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`,
      p0: { x: x1, y: y1 },
      p1: { x: cx1, y: cy1 },
      p2: { x: cx2, y: cy2 },
      p3: { x: x2, y: y2 }
    };
  },

  /**
   * Hit test a point against a cubic Bézier curve with threshold
   */
  hitTestBezier(px, py, x1, y1, x2, y2, threshold = 8) {
    const { p0, p1, p2, p3 } = this.calculateCubicBezier(x1, y1, x2, y2);
    const samples = 20;
    
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const t1 = 1 - t;
      const bx = t1 * t1 * t1 * p0.x + 3 * t1 * t1 * t * p1.x + 3 * t1 * t * t * p2.x + t * t * t * p3.x;
      const by = t1 * t1 * t1 * p0.y + 3 * t1 * t1 * t * p1.y + 3 * t1 * t * t * p2.y + t * t * t * p3.y;
      
      if (this.distance(px, py, bx, by) <= threshold) {
        return true;
      }
    }
    return false;
  },

  /**
   * Calculate Axis-Aligned Bounding Box (AABB) of an array of nodes
   */
  calculateAABB(nodes, padding = 60) {
    if (!nodes || nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600, centerX: 400, centerY: 300 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      const w = node.width || 240;
      const h = node.height || 160;
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + w);
      maxY = Math.max(maxY, node.y + h);
    }

    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(100, maxX - minX),
      height: Math.max(100, maxY - minY),
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  }
};
