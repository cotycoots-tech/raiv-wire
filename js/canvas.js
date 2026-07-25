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
        best = {
          nodeId: node.id,
          terminalId: p.terminal.id,
          x: p.x,
          y: p.y,
          side: p.side,
          node,
          terminal: p.terminal,
        };
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

/** Straight exit length from a terminal before any route bend (world units). */
export const CABLE_EXIT_STUB = 24;

/**
 * Point a fixed offset outward from a terminal, away from the device body.
 * side: "left" | "right" | "bottom" | "top"
 */
export function exitStubPoint(x, y, side, length = CABLE_EXIT_STUB) {
  switch (side) {
    case "left":
      return { x: x - length, y };
    case "right":
      return { x: x + length, y };
    case "bottom":
      return { x, y: y + length };
    case "top":
      return { x, y: y - length };
    default:
      return { x, y };
  }
}

export function cableEndpoints(cable, nodes) {
  const fromNode = nodes.find((n) => n.id === cable.from.nodeId);
  const toNode = nodes.find((n) => n.id === cable.to.nodeId);
  if (!fromNode || !toNode) return null;

  const fromPins = getTerminalPositions(fromNode);
  const toPins = getTerminalPositions(toNode);
  const fp = fromPins.find((p) => p.terminal.id === cable.from.terminalId) || fromPins[0];
  const tp = toPins.find((p) => p.terminal.id === cable.to.terminalId) || toPins[0];
  if (!fp || !tp) return null;
  return {
    x1: fp.x,
    y1: fp.y,
    x2: tp.x,
    y2: tp.y,
    side1: fp.side,
    side2: tp.side,
  };
}

/**
 * Resolve cable route control point (between exit stubs).
 * route: { midX, midY } — orthog path elbows (click-drag to adjust layout)
 */
export function getCableRouteHandle(cable, ep) {
  if (!ep) return null;
  const r = cable.route || {};
  const s1 = exitStubPoint(ep.x1, ep.y1, ep.side1);
  const s2 = exitStubPoint(ep.x2, ep.y2, ep.side2);
  const midX =
    typeof r.midX === "number" && Number.isFinite(r.midX)
      ? r.midX
      : (s1.x + s2.x) / 2;
  const midY =
    typeof r.midY === "number" && Number.isFinite(r.midY)
      ? r.midY
      : (s1.y + s2.y) / 2;
  return { midX, midY };
}

/**
 * Orthogonal cable path with fixed terminal exit stubs, then adjustable elbows:
 * pin1 → stub1 → H to midX → V to midY → H to stub2.x → V to stub2 → pin2
 * Stubs always leave the device first; bends only happen after the preset offset.
 */
export function cablePathD(ep, handle, yOffset = 0) {
  const x1 = ep.x1;
  const y1 = ep.y1 + yOffset;
  const x2 = ep.x2;
  const y2 = ep.y2 + yOffset;
  const s1 = exitStubPoint(x1, y1, ep.side1);
  const s2 = exitStubPoint(x2, y2, ep.side2);
  const mx = handle?.midX ?? (s1.x + s2.x) / 2;
  const my = (handle?.midY ?? (s1.y + s2.y) / 2) + (handle?.midY != null ? yOffset : 0);
  // pin → exit stub → mid channel → far stub → pin
  return (
    `M ${x1} ${y1}` +
    ` L ${s1.x} ${s1.y}` +
    ` L ${mx} ${s1.y}` +
    ` L ${mx} ${my}` +
    ` L ${s2.x} ${my}` +
    ` L ${s2.x} ${s2.y}` +
    ` L ${x2} ${y2}`
  );
}

function orthogonalPath(x1, y1, x2, y2, side1 = "right", side2 = "left") {
  const mx = (x1 + x2) / 2;
  return cablePathD(
    { x1, y1, x2, y2, side1, side2 },
    { midX: mx, midY: (y1 + y2) / 2 },
    0
  );
}

function primaryCableColor(cable) {
  const first = (cable.conductors || [])[0];
  if (!first) return "#94a3b8";
  return colorById(first.color).stroke;
}

/** Label position along routed path (near mid channel, past exit stubs) */
function cableLabelPoint(ep, handle) {
  const h = handle || getCableRouteHandle({ route: null }, ep);
  const s1 = exitStubPoint(ep.x1, ep.y1, ep.side1);
  const s2 = exitStubPoint(ep.x2, ep.y2, ep.side2);
  return {
    x: (s1.x + s2.x) / 2,
    y: (h.midY ?? (s1.y + s2.y) / 2) - 10,
  };
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
    const handle = getCableRouteHandle(cable, ep);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.dataset.cableId = cable.id;
    g.classList.add("cable-group");
    if (selected) g.classList.add("selected");

    // multi-conductor visual: parallel offset strokes for up to 4 colors
    const conductors = cable.conductors || [];
    const showN = Math.min(conductors.length, 4);
    for (let i = 0; i < showN; i++) {
      const c = conductors[i];
      const col = colorById(c.color);
      const offset = (i - (showN - 1) / 2) * 2.2;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const d = cablePathD(ep, handle, offset);
      path.setAttribute("d", d);
      path.setAttribute("class", `cable-path${selected ? " selected" : ""}`);
      path.setAttribute("stroke", col.stroke);
      path.setAttribute("stroke-width", selected ? "3.5" : "2.2");
      path.setAttribute("opacity", showN > 1 ? "0.9" : "1");
      path.dataset.cableId = cable.id;
      g.appendChild(path);
    }

    // hit area (wide for click-hold drag)
    const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hit.setAttribute("d", cablePathD(ep, handle, 0));
    hit.setAttribute("class", "cable-path cable-hit");
    hit.setAttribute("stroke", "transparent");
    hit.setAttribute("stroke-width", "14");
    hit.setAttribute("fill", "none");
    hit.style.cursor = "grab";
    hit.dataset.cableId = cable.id;
    g.appendChild(hit);

    // terminated cordset: connector markers at ends
    if (cable.terminated) {
      const addEndMarker = (x, y, end) => {
        const isLeads = end?.kind === "flying-leads" || end?.kind === "open";
        if (isLeads) {
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

    // route bend handle (always present for hit; stronger when selected)
    const hx = handle.midX;
    const hy = handle.midY;
    const handleHit = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    handleHit.setAttribute("cx", hx);
    handleHit.setAttribute("cy", hy);
    handleHit.setAttribute("r", selected ? 10 : 8);
    handleHit.setAttribute("fill", "transparent");
    handleHit.setAttribute("class", "cable-route-handle-hit");
    handleHit.style.cursor = "move";
    handleHit.dataset.cableId = cable.id;
    handleHit.dataset.routeHandle = "1";
    g.appendChild(handleHit);

    if (selected) {
      const handleRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      handleRing.setAttribute("cx", hx);
      handleRing.setAttribute("cy", hy);
      handleRing.setAttribute("r", 7);
      handleRing.setAttribute("class", "cable-route-handle");
      handleRing.setAttribute("fill", "#0b1220");
      handleRing.setAttribute("stroke", "#38bdf8");
      handleRing.setAttribute("stroke-width", "2");
      handleRing.dataset.cableId = cable.id;
      handleRing.dataset.routeHandle = "1";
      g.appendChild(handleRing);

      const handleDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      handleDot.setAttribute("cx", hx);
      handleDot.setAttribute("cy", hy);
      handleDot.setAttribute("r", 3);
      handleDot.setAttribute("fill", "#38bdf8");
      handleDot.dataset.cableId = cable.id;
      handleDot.dataset.routeHandle = "1";
      g.appendChild(handleDot);
    }

    // label
    const lp = cableLabelPoint(ep, handle);
    const termMark = cable.terminated ? "·T" : "";
    const label = `${cable.cableId || "C"}${termMark}`;
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    const tw = label.length * 6.2 + 10;
    bg.setAttribute("x", lp.x - tw / 2);
    bg.setAttribute("y", lp.y - 8);
    bg.setAttribute("width", tw);
    bg.setAttribute("height", 14);
    bg.setAttribute("class", "cable-label-bg");
    if (cable.terminated) {
      bg.setAttribute("stroke", "#2dd4bf");
    }
    bg.dataset.cableId = cable.id;
    g.appendChild(bg);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", lp.x);
    text.setAttribute("y", lp.y + 2);
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
  const side1 = from.side || null;
  const s1 = exitStubPoint(from.x, from.y, side1);
  const ep = {
    x1: from.x,
    y1: from.y,
    x2: toWorld.x,
    y2: toWorld.y,
    side1,
    side2: null, // free end — no stub until landed
  };
  const handle = {
    midX: (s1.x + toWorld.x) / 2,
    midY: (s1.y + toWorld.y) / 2,
  };
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", cablePathD(ep, handle, 0));
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
      const pad = CABLE_EXIT_STUB + 8;
      minX = Math.min(minX, p.x - pad);
      minY = Math.min(minY, p.y - pad);
      maxX = Math.max(maxX, p.x + pad);
      maxY = Math.max(maxY, p.y + pad);
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
