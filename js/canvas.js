/**
 * RAIV Wire — SVG canvas rendering & geometry helpers
 */

import { colorById } from "./data.js";

const CATEGORY_COLORS = {
  device: { fill: "#152238", stroke: "#60a5fa", accent: "#3b82f6" },
  jbox: { fill: "#1a1630", stroke: "#a78bfa", accent: "#8b5cf6" },
  terminal: { fill: "#241c10", stroke: "#fbbf24", accent: "#f59e0b" },
  connector: { fill: "#0f2422", stroke: "#2dd4bf", accent: "#14b8a6" },
};

export function screenToWorld(svg, viewport, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const sp = pt.matrixTransform(ctm.inverse());
  return {
    x: (sp.x - viewport.x) / viewport.scale,
    y: (sp.y - viewport.y) / viewport.scale,
  };
}

export function applyViewport(viewportEl, view) {
  viewportEl.setAttribute(
    "transform",
    `translate(${view.x}, ${view.y}) scale(${view.scale})`
  );
}

/** Terminal pin positions around node perimeter */
export function getTerminalPositions(node) {
  const terms = node.terminals || [];
  const n = terms.length;
  if (!n) return [];

  const isPe = (t) => {
    const id = String(t.id || "").toUpperCase();
    const name = String(t.name || "").toUpperCase();
    return (
      id === "PE" ||
      id === "SH" ||
      id.includes("PE") ||
      name.includes("PE") ||
      name.includes("GND") ||
      name.includes("SHIELD") ||
      name.includes("SHELL")
    );
  };
  const isField = (t) => /^F\d+/i.test(String(t.id || ""));
  const isPanel = (t) => /^P\d+/i.test(String(t.id || ""));

  let left, right, bottom;

  // Bulkhead / dual-sided connectors: F* field left, P* panel right, shield bottom
  const fieldPins = terms.filter(isField);
  const panelPins = terms.filter(isPanel);
  if (fieldPins.length && panelPins.length) {
    left = fieldPins;
    right = panelPins;
    bottom = terms.filter((t) => !isField(t) && !isPanel(t));
  } else {
    bottom = n > 4 ? terms.filter(isPe) : [];
    const main = n > 4 ? terms.filter((t) => !isPe(t)) : terms.slice();
    const mid = Math.ceil(main.length / 2);
    left = main.slice(0, mid);
    right = main.slice(mid);
  }

  const positions = [];
  const placeSide = (list, side) => {
    list.forEach((t, i) => {
      const count = list.length;
      const t_frac = (i + 1) / (count + 1);
      let x, y, anchor;
      if (side === "left") {
        x = node.x;
        y = node.y + node.height * t_frac;
        anchor = "left";
      } else if (side === "right") {
        x = node.x + node.width;
        y = node.y + node.height * t_frac;
        anchor = "right";
      } else {
        x = node.x + node.width * t_frac;
        y = node.y + node.height;
        anchor = "bottom";
      }
      positions.push({ terminal: t, x, y, side: anchor });
    });
  };

  placeSide(left, "left");
  placeSide(right, "right");
  placeSide(bottom, "bottom");
  return positions;
}

export function findTerminalAt(nodes, worldX, worldY, hitR = 12) {
  let best = null;
  let bestD = hitR;
  for (const node of nodes) {
    for (const p of getTerminalPositions(node)) {
      const d = Math.hypot(p.x - worldX, p.y - worldY);
      if (d < bestD) {
        bestD = d;
        best = { nodeId: node.id, terminalId: p.terminal.id, x: p.x, y: p.y, node, terminal: p.terminal };
      }
    }
  }
  return best;
}

export function findNodeAt(nodes, worldX, worldY) {
  // top-most last drawn = reverse
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (
      worldX >= n.x &&
      worldX <= n.x + n.width &&
      worldY >= n.y &&
      worldY <= n.y + n.height
    ) {
      return n;
    }
  }
  return null;
}

function cableEndpoints(cable, nodes) {
  const fromNode = nodes.find((n) => n.id === cable.from.nodeId);
  const toNode = nodes.find((n) => n.id === cable.to.nodeId);
  if (!fromNode || !toNode) return null;

  const fromPins = getTerminalPositions(fromNode);
  const toPins = getTerminalPositions(toNode);
  const fp = fromPins.find((p) => p.terminal.id === cable.from.terminalId) || fromPins[0];
  const tp = toPins.find((p) => p.terminal.id === cable.to.terminalId) || toPins[0];
  if (!fp || !tp) return null;
  return { x1: fp.x, y1: fp.y, x2: tp.x, y2: tp.y };
}

function orthogonalPath(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2;
  // simple orthog: H-V-H
  return `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`;
}

function primaryCableColor(cable) {
  const first = (cable.conductors || [])[0];
  if (!first) return "#94a3b8";
  return colorById(first.color).stroke;
}

export function renderDiagram(layers, project, selection, hoverTerm) {
  const { nodes, cables } = project;
  const layerNodes = layers.nodes;
  const layerCables = layers.cables;
  const layerOverlay = layers.overlay;

  layerNodes.innerHTML = "";
  layerCables.innerHTML = "";
  layerOverlay.innerHTML = "";

  // Cables first (under nodes)
  for (const cable of cables) {
    const ep = cableEndpoints(cable, nodes);
    if (!ep) continue;
    const selected = selection?.type === "cable" && selection.id === cable.id;
    const color = primaryCableColor(cable);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.dataset.cableId = cable.id;

    // multi-conductor visual: parallel offset strokes for up to 4 colors
    const conductors = cable.conductors || [];
    const showN = Math.min(conductors.length, 4);
    for (let i = 0; i < showN; i++) {
      const c = conductors[i];
      const col = colorById(c.color);
      const offset = (i - (showN - 1) / 2) * 2.2;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      // offset approximate via perpendicular — use simple y offset on mid for visual bundle
      const d = orthogonalPath(ep.x1, ep.y1 + offset, ep.x2, ep.y2 + offset);
      path.setAttribute("d", d);
      path.setAttribute("class", `cable-path${selected ? " selected" : ""}`);
      path.setAttribute("stroke", col.stroke);
      path.setAttribute("stroke-width", selected ? "3.5" : "2.2");
      path.setAttribute("opacity", showN > 1 ? "0.9" : "1");
      path.dataset.cableId = cable.id;
      g.appendChild(path);
    }

    // hit area
    const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hit.setAttribute("d", orthogonalPath(ep.x1, ep.y1, ep.x2, ep.y2));
    hit.setAttribute("class", "cable-path");
    hit.setAttribute("stroke", "transparent");
    hit.setAttribute("stroke-width", "12");
    hit.dataset.cableId = cable.id;
    g.appendChild(hit);

    // terminated cordset: connector markers at ends
    if (cable.terminated) {
      const addEndMarker = (x, y, end) => {
        const isLeads = end?.kind === "flying-leads" || end?.kind === "open";
        if (isLeads) {
          // short tick marks for open leads
          for (let i = -1; i <= 1; i++) {
            const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
            tick.setAttribute("x1", x - 4);
            tick.setAttribute("y1", y + i * 3);
            tick.setAttribute("x2", x + 4);
            tick.setAttribute("y2", y + i * 3);
            tick.setAttribute("stroke", color);
            tick.setAttribute("stroke-width", "1.5");
            tick.setAttribute("opacity", "0.85");
            tick.dataset.cableId = cable.id;
            g.appendChild(tick);
          }
        } else {
          const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          r.setAttribute("x", x - 5);
          r.setAttribute("y", y - 5);
          r.setAttribute("width", 10);
          r.setAttribute("height", 10);
          r.setAttribute("rx", 2);
          r.setAttribute("fill", "#0f2422");
          r.setAttribute("stroke", "#2dd4bf");
          r.setAttribute("stroke-width", "1.5");
          r.dataset.cableId = cable.id;
          g.appendChild(r);
        }
      };
      addEndMarker(ep.x1, ep.y1, cable.endA);
      addEndMarker(ep.x2, ep.y2, cable.endB);
    }

    // label
    const mx = (ep.x1 + ep.x2) / 2;
    const my = (ep.y1 + ep.y2) / 2 - 8;
    const termMark = cable.terminated ? "·T" : "";
    const label = `${cable.cableId || "C"}${termMark}`;
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    const tw = label.length * 6.2 + 10;
    bg.setAttribute("x", mx - tw / 2);
    bg.setAttribute("y", my - 8);
    bg.setAttribute("width", tw);
    bg.setAttribute("height", 14);
    bg.setAttribute("class", "cable-label-bg");
    if (cable.terminated) {
      bg.setAttribute("stroke", "#2dd4bf");
    }
    bg.dataset.cableId = cable.id;
    g.appendChild(bg);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", mx);
    text.setAttribute("y", my + 2);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "cable-label-text");
    text.setAttribute("fill", cable.terminated ? "#2dd4bf" : color);
    text.textContent = label;
    text.dataset.cableId = cable.id;
    g.appendChild(text);

    layerCables.appendChild(g);
  }

  // Nodes
  for (const node of nodes) {
    const colors = CATEGORY_COLORS[node.category] || CATEGORY_COLORS.device;
    const selected = selection?.type === "node" && selection.id === node.id;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.classList.add("node-group");
    if (selected) g.classList.add("selected");
    g.dataset.nodeId = node.id;
    g.setAttribute("transform", `translate(0,0)`);

    // body
    const body = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    body.setAttribute("x", node.x);
    body.setAttribute("y", node.y);
    body.setAttribute("width", node.width);
    body.setAttribute("height", node.height);
    body.setAttribute("rx", node.category === "terminal" ? 4 : 8);
    body.setAttribute("class", "node-body");
    body.setAttribute("fill", colors.fill);
    body.setAttribute("stroke", colors.stroke);
    body.setAttribute("stroke-width", selected ? 2.5 : 1.5);
    body.dataset.nodeId = node.id;
    g.appendChild(body);

    // header bar
    const headerH = 18;
    const header = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    header.setAttribute("x", node.x);
    header.setAttribute("y", node.y);
    header.setAttribute("width", node.width);
    header.setAttribute("height", headerH);
    header.setAttribute("rx", node.category === "terminal" ? 4 : 8);
    header.setAttribute("fill", colors.accent);
    header.setAttribute("opacity", "0.25");
    header.dataset.nodeId = node.id;
    g.appendChild(header);
    // square bottom of header
    const headerFix = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    headerFix.setAttribute("x", node.x);
    headerFix.setAttribute("y", node.y + headerH - 6);
    headerFix.setAttribute("width", node.width);
    headerFix.setAttribute("height", 6);
    headerFix.setAttribute("fill", colors.accent);
    headerFix.setAttribute("opacity", "0.25");
    headerFix.dataset.nodeId = node.id;
    g.appendChild(headerFix);

    // tag
    const tag = document.createElementNS("http://www.w3.org/2000/svg", "text");
    tag.setAttribute("x", node.x + 8);
    tag.setAttribute("y", node.y + 13);
    tag.setAttribute("class", "node-label");
    tag.setAttribute("fill", colors.stroke);
    tag.textContent = node.tag;
    tag.dataset.nodeId = node.id;
    g.appendChild(tag);

    // name
    const name = document.createElementNS("http://www.w3.org/2000/svg", "text");
    name.setAttribute("x", node.x + node.width / 2);
    name.setAttribute("y", node.y + node.height / 2 + 4);
    name.setAttribute("text-anchor", "middle");
    name.setAttribute("class", "node-sub");
    name.textContent = truncate(node.name || node.type, 16);
    name.dataset.nodeId = node.id;
    g.appendChild(name);

    // type badge bottom
    const typeT = document.createElementNS("http://www.w3.org/2000/svg", "text");
    typeT.setAttribute("x", node.x + node.width / 2);
    typeT.setAttribute("y", node.y + node.height - 8);
    typeT.setAttribute("text-anchor", "middle");
    typeT.setAttribute("class", "node-sub");
    typeT.setAttribute("opacity", "0.7");
    typeT.textContent = (node.type || "").toUpperCase();
    typeT.dataset.nodeId = node.id;
    g.appendChild(typeT);

    // Bulkhead mate face labels: FIELD | PANEL
    if (node.category === "connector") {
      const fieldL = document.createElementNS("http://www.w3.org/2000/svg", "text");
      fieldL.setAttribute("x", node.x + 6);
      fieldL.setAttribute("y", node.y + node.height / 2 + 14);
      fieldL.setAttribute("class", "node-sub");
      fieldL.setAttribute("fill", "#2dd4bf");
      fieldL.setAttribute("opacity", "0.9");
      fieldL.style.fontSize = "8px";
      fieldL.textContent = "FIELD";
      fieldL.dataset.nodeId = node.id;
      g.appendChild(fieldL);

      const panelL = document.createElementNS("http://www.w3.org/2000/svg", "text");
      panelL.setAttribute("x", node.x + node.width - 6);
      panelL.setAttribute("y", node.y + node.height / 2 + 14);
      panelL.setAttribute("text-anchor", "end");
      panelL.setAttribute("class", "node-sub");
      panelL.setAttribute("fill", "#94a3b8");
      panelL.setAttribute("opacity", "0.9");
      panelL.style.fontSize = "8px";
      panelL.textContent = "PANEL";
      panelL.dataset.nodeId = node.id;
      g.appendChild(panelL);

      if (node.mateCoding) {
        const code = document.createElementNS("http://www.w3.org/2000/svg", "text");
        code.setAttribute("x", node.x + node.width / 2);
        code.setAttribute("y", node.y + node.height / 2 - 6);
        code.setAttribute("text-anchor", "middle");
        code.setAttribute("class", "node-sub");
        code.setAttribute("fill", "#2dd4bf");
        code.setAttribute("opacity", "0.85");
        code.style.fontSize = "8px";
        code.textContent = `${node.mateCoding}${node.mateFace ? " · " + node.mateFace[0].toUpperCase() : ""}`;
        code.dataset.nodeId = node.id;
        g.appendChild(code);
      }
    }

    // terminals
    for (const p of getTerminalPositions(node)) {
      const isHot =
        hoverTerm &&
        hoverTerm.nodeId === node.id &&
        hoverTerm.terminalId === p.terminal.id;
      const isSelEnd =
        selection?.type === "cable-end" &&
        selection.nodeId === node.id &&
        selection.terminalId === p.terminal.id;

      const pin = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      pin.setAttribute("cx", p.x);
      pin.setAttribute("cy", p.y);
      pin.setAttribute("r", isHot || isSelEnd ? 6 : 4.5);
      pin.setAttribute("class", `term-pin${isHot ? " hot" : ""}${isSelEnd ? " selected-end" : ""}`);
      pin.setAttribute("fill", isSelEnd ? "#34d399" : isHot ? "#38bdf8" : colors.stroke);
      pin.setAttribute("stroke", "#0b1220");
      pin.setAttribute("stroke-width", "1.5");
      pin.dataset.nodeId = node.id;
      pin.dataset.terminalId = p.terminal.id;
      g.appendChild(pin);

      const tl = document.createElementNS("http://www.w3.org/2000/svg", "text");
      const ox = p.side === "left" ? -8 : p.side === "right" ? 8 : 0;
      const oy = p.side === "bottom" ? 12 : -8;
      tl.setAttribute("x", p.x + ox);
      tl.setAttribute("y", p.y + oy);
      tl.setAttribute("text-anchor", p.side === "left" ? "end" : p.side === "right" ? "start" : "middle");
      tl.setAttribute("class", "term-label");
      tl.textContent = p.terminal.id;
      g.appendChild(tl);
    }

    layerNodes.appendChild(g);
  }
}

export function renderCablePreview(overlay, from, toWorld) {
  overlay.innerHTML = "";
  if (!from || !toWorld) return;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", orthogonalPath(from.x, from.y, toWorld.x, toWorld.y));
  path.setAttribute("class", "cable-preview-line");
  overlay.appendChild(path);
}

function truncate(s, n) {
  s = String(s || "");
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** Content bounding box in world coordinates (nodes + cable endpoints pad) */
export function contentBounds(project, padding = 40) {
  const nodes = project.nodes || [];
  if (!nodes.length) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
    for (const p of getTerminalPositions(n)) {
      minX = Math.min(minX, p.x - 12);
      minY = Math.min(minY, p.y - 12);
      maxX = Math.max(maxX, p.x + 12);
      maxY = Math.max(maxY, p.y + 12);
    }
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
    width: Math.max(maxX - minX, 100),
    height: Math.max(maxY - minY, 100),
  };
}

export function fitView(svg, project, padding = 60) {
  const nodes = project.nodes;
  if (!nodes.length) {
    return { x: 0, y: 0, scale: 1 };
  }
  const b = contentBounds(project, padding);
  const rect = svg.getBoundingClientRect();
  const w = Math.max(rect.width, 100);
  const h = Math.max(rect.height, 100);
  const scale = Math.min(1.5, Math.max(0.25, Math.min(w / b.width, h / b.height)));
  const x = (w - b.width * scale) / 2 - b.minX * scale;
  const y = (h - b.height * scale) / 2 - b.minY * scale;
  return { x, y, scale };
}
