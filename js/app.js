/**
 * RAIV Wire — main application
 */

import {
  WIRE_COLORS,
  CABLE_TEMPLATES,
  COMPONENT_CATALOG,
  createEmptyProject,
  createNode,
  createCableFromTemplate,
  deepClone,
  landingRef,
  colorById,
  endLabel,
  openCableTemplates,
  terminatedTemplatesBySubcategory,
  bulkheadCatalog,
  mapCableLandingsToNodes,
  mateSideFromTerminalId,
  uid,
} from "./data.js";

import {
  screenToWorld,
  applyViewport,
  renderDiagram,
  renderCablePreview,
  findTerminalAt,
  findNodeAt,
  fitView,
  contentBounds,
  getTerminalPositions,
} from "./canvas.js";

import {
  loadCatalog,
  catalogByGroup,
  getCatalogItem,
  itemFromNode,
  addCatalogItem,
  removeCatalogItem,
  updateCatalogItem,
  createNodeFromCatalogItem,
  exportCatalogJson,
  importCatalogJson,
  resetCatalogToDefaults,
  INVENTORY_GROUPS,
} from "./catalog.js";

// ── State ──
const state = {
  project: createEmptyProject(),
  tool: "select", // select | pan | cable | place
  placeType: null,
  selection: null, // { type: 'node'|'cable', id }
  cableFrom: null, // { nodeId, terminalId, x, y }
  cableTemplateId: CABLE_TEMPLATES[5].id, // 3C control default
  activeColorId: "RD",
  hoverTerm: null,
  dragging: null, // { nodeId, ox, oy }
  panning: null, // { sx, sy, vx, vy }
  history: [],
  future: [],
  dirty: false,
  printRestore: null,
  placeCatalogId: null, // inventory catalog item to place
  catalogFilter: "",
};

const STORAGE_KEY = "raiv-wire-project-v1";

// ── DOM ──
const $ = (sel) => document.querySelector(sel);
const svg = $("#diagram");
const viewportEl = $("#viewport");
const layers = {
  nodes: $("#layer-nodes"),
  cables: $("#layer-cables"),
  overlay: $("#layer-overlay"),
};
const canvasContainer = $("#canvas-container");
const projectNameInput = $("#project-name");
const statusMsg = $("#status-msg");
const zoomLabel = $("#zoom-label");
const cursorPos = $("#cursor-pos");
const propsEmpty = $("#props-empty");
const propsForm = $("#props-form");
const wireTableBody = $("#wire-table-body");
const landingMap = $("#landing-map");
const landingContext = $("#landing-context");
const fileImport = $("#file-import");
const modal = $("#modal");
const modalTitle = $("#modal-title");
const modalBody = $("#modal-body");
const modalOk = $("#modal-ok");
const modalCancel = $("#modal-cancel");

// ── History ──
function pushHistory() {
  state.history.push(deepClone(state.project));
  if (state.history.length > 50) state.history.shift();
  state.future = [];
  state.dirty = true;
}

function undo() {
  if (!state.history.length) return;
  state.future.push(deepClone(state.project));
  state.project = state.history.pop();
  state.selection = null;
  state.cableFrom = null;
  render();
  setStatus("Undo");
}

function redo() {
  if (!state.future.length) return;
  state.history.push(deepClone(state.project));
  state.project = state.future.pop();
  state.selection = null;
  render();
  setStatus("Redo");
}

// ── Status / view ──
function setStatus(msg) {
  statusMsg.textContent = msg;
}

function setTool(tool) {
  state.tool = tool;
  if (tool !== "place") {
    state.placeType = null;
    state.placeCatalogId = null;
  }
  if (tool !== "cable") state.cableFrom = null;
  document.querySelectorAll(".tool[data-tool]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tool === tool);
  });
  document.querySelectorAll(".palette-item").forEach((el) => {
    el.classList.toggle(
      "active",
      tool === "place" && !state.placeCatalogId && el.dataset.type === state.placeType
    );
  });
  document.querySelectorAll(".catalog-item").forEach((el) => {
    el.classList.toggle(
      "active",
      tool === "place" && state.placeCatalogId && el.dataset.catalogId === state.placeCatalogId
    );
  });
  canvasContainer.className = "";
  canvasContainer.classList.add(
    tool === "pan" ? "tool-pan" : tool === "cable" ? "tool-cable" : "tool-select"
  );
  layers.overlay.innerHTML = "";
  if (tool === "place" && state.placeCatalogId) {
    const item = getCatalogItem(state.placeCatalogId);
    setStatus(`Place catalog: ${item?.catalogName || state.placeCatalogId}`);
  } else if (tool === "place") {
    setStatus(`Place: ${state.placeType}`);
  } else {
    setStatus(`Tool: ${tool}`);
  }
}

function updateZoomLabel() {
  zoomLabel.textContent = `${Math.round(state.project.view.scale * 100)}%`;
}

function setView(view) {
  state.project.view = view;
  applyViewport(viewportEl, view);
  updateZoomLabel();
}

// ── Render ──
function render() {
  applyViewport(viewportEl, state.project.view);
  renderDiagram(layers, state.project, state.selection, state.hoverTerm);
  if (state.cableFrom) {
    // keep preview if any
  }
  renderProps();
  renderWireTable();
  renderLandings();
  projectNameInput.value = state.project.name || "";
  updateZoomLabel();
  persistDebounced();
}

// ── Palette ──
function buildPalette() {
  const devEl = $("#palette-devices");
  const encEl = $("#palette-enclosures");
  const termEl = $("#palette-terminals");
  const connEl = $("#palette-connectors");

  const makeItem = (cat, opts = {}) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `palette-item${cat.category === "connector" ? " bulkhead-item" : ""}`;
    btn.dataset.type = cat.type;
    btn.draggable = true;
    const mateHint =
      cat.category === "connector" && cat.mateCoding
        ? ` · mate ${cat.mateFace || "F"} ${cat.mateCoding}`
        : "";
    btn.innerHTML = `
      <span class="pi-icon ${cat.category}">${(cat.tagPrefix || "?").slice(0, 3)}</span>
      <span class="pi-label">${cat.label}</span>
      <span class="pi-sub">${cat.defaultTerminals.length} landings${mateHint}</span>
      ${cat.category === "connector" ? `<span class="pi-drop">drag onto canvas</span>` : ""}
    `;
    btn.addEventListener("click", () => {
      state.placeType = cat.type;
      state.placeCatalogId = null;
      setTool("place");
      document.querySelectorAll(".palette-item").forEach((el) => {
        el.classList.toggle("active", el.dataset.type === cat.type);
      });
      document.querySelectorAll(".catalog-item").forEach((el) => el.classList.remove("active"));
      if (cat.category === "connector") {
        setStatus(`Place bulkhead: click canvas (or drag) — ${cat.label}. Mate cordset to Field (F) pins.`);
      }
    });
    btn.addEventListener("dragstart", (e) => {
      state.placeCatalogId = null;
      e.dataTransfer.setData("application/x-raiv-component", cat.type);
      e.dataTransfer.setData("text/plain", cat.type);
      e.dataTransfer.effectAllowed = "copy";
      btn.classList.add("dragging");
      setStatus(`Drop ${cat.label} on canvas to place`);
    });
    btn.addEventListener("dragend", () => btn.classList.remove("dragging"));
    return btn;
  };

  COMPONENT_CATALOG.devices.forEach((c) => devEl.appendChild(makeItem(c)));
  COMPONENT_CATALOG.enclosures.forEach((c) => encEl.appendChild(makeItem(c)));
  COMPONENT_CATALOG.terminals.forEach((c) => termEl.appendChild(makeItem(c)));
  bulkheadCatalog().forEach((c) => connEl.appendChild(makeItem(c)));

  loadCatalog();
  renderCatalogPalette();
  bindCatalogUi();

  // colors
  const sw = $("#color-swatches");
  WIRE_COLORS.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `swatch${c.striped ? " striped" : ""}${c.id === state.activeColorId ? " active" : ""}`;
    b.style.background = c.hex;
    if (c.striped && c.stripe) {
      b.style.background = `repeating-linear-gradient(-45deg, ${c.hex}, ${c.hex} 4px, ${c.stripe} 4px, ${c.stripe} 8px)`;
    }
    b.title = `${c.name} (${c.id}) — ${c.usage}`;
    b.dataset.colorId = c.id;
    b.addEventListener("click", () => {
      state.activeColorId = c.id;
      sw.querySelectorAll(".swatch").forEach((el) => {
        el.classList.toggle("active", el.dataset.colorId === c.id);
      });
      setStatus(`Wire color: ${c.name}`);
    });
    sw.appendChild(b);
  });

  // cable templates — open + terminated (with subcategories)
  const makeCableTemplateButton = (t) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `cable-tpl${t.terminated ? " terminated" : ""}${t.id === state.cableTemplateId ? " active" : ""}`;
    b.dataset.templateId = t.id;
    if (t.subcategory) b.dataset.subcategory = t.subcategory;
    const dots = t.conductors
      .map((c) => {
        const col = colorById(c.color);
        return `<span class="ct-dot" style="background:${col.hex}" title="${col.name}"></span>`;
      })
      .join("");
    const ends = t.terminated
      ? `${endLabel(t.endA)} → ${endLabel(t.endB)}`
      : `${t.conductors.length}C · open ends`;
    b.innerHTML = `
      <span class="ct-name">${t.terminated ? `<span class="ct-term-tag">TERM</span> ` : ""}${t.name}</span>
      <span class="ct-colors">${dots}</span>
      <span class="ct-meta">AWG ${t.awg} · ${t.type}${t.defaultLength ? ` · ${t.defaultLength}` : ""}</span>
      <span class="ct-ends">${ends}</span>
    `;
    b.addEventListener("click", () => {
      state.cableTemplateId = t.id;
      document.querySelectorAll(".cable-tpl").forEach((el) => {
        el.classList.toggle("active", el.dataset.templateId === t.id);
      });
      setTool("cable");
      const kind = t.terminated ? "Terminated cordset" : "Open cable";
      setStatus(`${kind}: ${t.name} — click from terminal, then to terminal`);
    });
    return b;
  };

  const mountCableTemplates = (container, list) => {
    list.forEach((t) => container.appendChild(makeCableTemplateButton(t)));
  };

  const mountTerminatedBySubcategory = (container) => {
    container.innerHTML = "";
    for (const group of terminatedTemplatesBySubcategory()) {
      const details = document.createElement("details");
      details.className = "cable-subcat";
      details.open =
        group.id === "ethernet" ||
        group.id === "m12-sensor" ||
        group.id === "panel";
      details.dataset.subcategory = group.id;

      const summary = document.createElement("summary");
      summary.className = "cable-subcat-summary";
      summary.innerHTML = `
        <span class="cable-subcat-label">${group.label}</span>
        <span class="cable-subcat-count">${group.templates.length}</span>
      `;
      details.appendChild(summary);

      const listEl = document.createElement("div");
      listEl.className = "cable-templates cable-subcat-list";
      group.templates.forEach((t) => listEl.appendChild(makeCableTemplateButton(t)));
      details.appendChild(listEl);
      container.appendChild(details);
    }
  };

  mountCableTemplates($("#cable-templates"), openCableTemplates());
  mountTerminatedBySubcategory($("#cable-templates-terminated"));

  // Extra placeable bulkheads under terminated → Bulkhead / panel subcategory
  injectBulkheadPlaceables();
}

/** Show placeable bulkhead connectors inside terminated "Bulkhead / panel" group */
function injectBulkheadPlaceables() {
  const container = $("#cable-templates-terminated");
  if (!container) return;
  const panelGroup = container.querySelector('[data-subcategory="panel"]');
  if (!panelGroup) return;

  let listEl = panelGroup.querySelector(".cable-subcat-list");
  if (!listEl) return;

  const intro = document.createElement("div");
  intro.className = "bulkhead-place-intro";
  intro.textContent =
    "Place a bulkhead on the canvas, then attach a terminated cordset to Field (left) or Panel (right) landings.";
  listEl.insertBefore(intro, listEl.firstChild);

  const placeGrid = document.createElement("div");
  placeGrid.className = "bulkhead-place-grid";
  for (const cat of bulkheadCatalog()) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "palette-item bulkhead-item";
    btn.draggable = true;
    btn.dataset.type = cat.type;
    btn.innerHTML = `
      <span class="pi-icon connector">${(cat.tagPrefix || "BH").slice(0, 3)}</span>
      <span class="pi-label">${cat.label}</span>
      <span class="pi-sub">drop / click to place</span>
    `;
    btn.addEventListener("click", () => {
      state.placeType = cat.type;
      setTool("place");
      document.querySelectorAll(".palette-item").forEach((el) => {
        el.classList.toggle("active", el.dataset.type === cat.type);
      });
      setStatus(`Place bulkhead: ${cat.label} — click or drop on canvas`);
    });
    btn.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("application/x-raiv-component", cat.type);
      e.dataTransfer.setData("text/plain", cat.type);
      e.dataTransfer.effectAllowed = "copy";
    });
    placeGrid.appendChild(btn);
  }
  listEl.insertBefore(placeGrid, listEl.children[1] || null);
}

function placeComponentAt(type, worldX, worldY) {
  pushHistory();
  const node = createNode(type, worldX - 40, worldY - 30, state.project.nodes);
  state.project.nodes.push(node);
  state.selection = { type: "node", id: node.id };
  state.project.updatedAt = new Date().toISOString();
  setTool("select");
  render();
  const mate =
    node.isBulkhead && node.mateCoding
      ? ` — mate face ${node.mateFace || "F"} ${node.mateCoding} (${node.matePins} pin). Attach cordset to F* field pins.`
      : "";
  setStatus(`Placed ${node.tag}${mate}`);
  return node;
}

function placeCatalogItemAt(catalogId, worldX, worldY) {
  const item = getCatalogItem(catalogId);
  if (!item) {
    setStatus("Catalog item not found");
    return null;
  }
  pushHistory();
  const node = createNodeFromCatalogItem(
    item,
    worldX - 40,
    worldY - 30,
    state.project.nodes
  );
  state.project.nodes.push(node);
  state.selection = { type: "node", id: node.id };
  state.project.updatedAt = new Date().toISOString();
  setTool("select");
  render();
  setStatus(
    `Placed ${node.tag} from catalog (${item.catalogName}${item.partNumber ? " · " + item.partNumber : ""})`
  );
  return node;
}

// ── Device catalog palette ──
function renderCatalogPalette() {
  const root = $("#palette-catalog");
  if (!root) return;
  const q = (state.catalogFilter || "").trim().toLowerCase();
  root.innerHTML = "";

  let groups = catalogByGroup();
  if (q) {
    groups = groups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => {
          const hay = [
            i.catalogName,
            i.name,
            i.manufacturer,
            i.partNumber,
            i.description,
            i.baseType,
          ]
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        }),
      }))
      .filter((g) => g.items.length);
  }

  if (!groups.length) {
    root.innerHTML = `<div class="catalog-empty">No catalog items${q ? " match" : ""}. Configure a device and use Save to catalog.</div>`;
    return;
  }

  for (const group of groups) {
    const details = document.createElement("details");
    details.className = "cable-subcat";
    details.open = true;
    details.dataset.inventoryGroup = group.id;

    const summary = document.createElement("summary");
    summary.className = "cable-subcat-summary";
    summary.innerHTML = `
      <span class="cable-subcat-label">${group.label}</span>
      <span class="cable-subcat-count">${group.items.length}</span>
    `;
    details.appendChild(summary);

    const list = document.createElement("div");
    list.className = "cable-subcat-list";
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "6px";

    for (const item of group.items) {
      list.appendChild(makeCatalogItemButton(item));
    }
    details.appendChild(list);
    root.appendChild(details);
  }
}

function makeCatalogItemButton(item) {
  const btn = document.createElement("div");
  btn.className = `catalog-item${state.placeCatalogId === item.id ? " active" : ""}`;
  btn.draggable = true;
  btn.dataset.catalogId = item.id;
  btn.innerHTML = `
    <span class="ci-title">${escapeHtml(item.catalogName)}</span>
    <span class="ci-meta">${escapeHtml(item.manufacturer || "—")} · ${escapeHtml(item.partNumber || "no P/N")}</span>
    <span class="ci-terms">${(item.terminals || []).length} terminals · tag ${escapeHtml(item.tagPrefix || "?")} · ${escapeHtml(item.baseType)}</span>
    <div class="ci-actions">
      <button type="button" data-action="place" title="Place on canvas">Place</button>
      <button type="button" data-action="delete" title="Remove from catalog">Delete</button>
    </div>
  `;

  const selectPlace = () => {
    state.placeCatalogId = item.id;
    state.placeType = null;
    setTool("place");
    document.querySelectorAll(".catalog-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.catalogId === item.id);
    });
    document.querySelectorAll(".palette-item").forEach((el) => el.classList.remove("active"));
  };

  btn.addEventListener("click", (e) => {
    if (e.target.closest("[data-action]")) return;
    selectPlace();
  });

  btn.querySelector('[data-action="place"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    selectPlace();
    setStatus(`Catalog place: ${item.catalogName} — click or drop on canvas`);
  });

  btn.querySelector('[data-action="delete"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!confirm(`Remove "${item.catalogName}" from device catalog?`)) return;
    removeCatalogItem(item.id);
    if (state.placeCatalogId === item.id) {
      state.placeCatalogId = null;
      setTool("select");
    }
    renderCatalogPalette();
    setStatus("Removed from catalog");
  });

  btn.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("application/x-raiv-catalog", item.id);
    e.dataTransfer.setData("text/plain", `catalog:${item.id}`);
    e.dataTransfer.effectAllowed = "copy";
    setStatus(`Drop ${item.catalogName} on canvas`);
  });

  return btn;
}

function bindCatalogUi() {
  $("#catalog-search")?.addEventListener("input", (e) => {
    state.catalogFilter = e.target.value;
    renderCatalogPalette();
  });

  $("#btn-catalog-export")?.addEventListener("click", () => {
    const blob = new Blob([exportCatalogJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "raiv-wire-device-catalog.json";
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus("Catalog exported");
  });

  $("#btn-catalog-import")?.addEventListener("click", () => {
    $("#file-catalog-import")?.click();
  });

  $("#file-catalog-import")?.addEventListener("change", () => {
    const f = $("#file-catalog-import")?.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importCatalogJson(reader.result, "merge");
        renderCatalogPalette();
        setStatus("Catalog imported (merged)");
      } catch (err) {
        alert("Catalog import failed: " + err.message);
      }
    };
    reader.readAsText(f);
    $("#file-catalog-import").value = "";
  });

  $("#btn-catalog-reset")?.addEventListener("click", () => {
    if (!confirm("Reset device catalog to starter inventory? Your custom items will be removed from this browser.")) {
      return;
    }
    resetCatalogToDefaults();
    renderCatalogPalette();
    setStatus("Catalog reset to defaults");
  });

  // Save-to-catalog modal
  const groupSel = $("#cat-modal-group");
  if (groupSel) {
    groupSel.innerHTML = INVENTORY_GROUPS.map(
      (g) => `<option value="${g.id}">${g.label}</option>`
    ).join("");
  }
  $("#cat-modal-cancel")?.addEventListener("click", () => {
    $("#catalog-modal")?.classList.add("hidden");
  });
  $("#cat-modal-save")?.addEventListener("click", () => {
    const nodeId = $("#catalog-modal")?.dataset.nodeId;
    const node = state.project.nodes.find((n) => n.id === nodeId);
    if (!node) {
      $("#catalog-modal")?.classList.add("hidden");
      return;
    }
    const item = itemFromNode(node, {
      catalogName: $("#cat-modal-name")?.value.trim() || node.name,
      inventoryGroup: $("#cat-modal-group")?.value || "other",
      tagPrefix: $("#cat-modal-prefix")?.value.trim() || undefined,
    });
    // Update existing catalog entry if this node came from one
    if (node.catalogId && getCatalogItem(node.catalogId)) {
      updateCatalogItem(node.catalogId, {
        ...item,
        id: node.catalogId,
      });
      setStatus(`Updated catalog: ${item.catalogName}`);
    } else {
      const saved = addCatalogItem(item);
      node.catalogId = saved.id;
      node.catalogName = saved.catalogName;
      setStatus(`Saved to catalog: ${saved.catalogName}`);
    }
    $("#catalog-modal")?.classList.add("hidden");
    renderCatalogPalette();
    render();
  });
}

function openSaveToCatalogModal(node) {
  const modal = $("#catalog-modal");
  if (!modal) return;
  modal.dataset.nodeId = node.id;
  $("#cat-modal-name").value =
    node.catalogName ||
    [node.manufacturer, node.partNumber || node.name].filter(Boolean).join(" ") ||
    node.name;
  $("#cat-modal-prefix").value = (String(node.tag || "").match(/^[A-Za-z]+/) || ["X"])[0];
  const guess =
    node.type === "plc"
      ? "plc"
      : node.type === "vfd" || node.type === "motor" || node.type === "contactor"
        ? "drives"
        : node.type === "sensor"
          ? "sensors"
          : node.type === "hmi" || node.type === "pushbutton"
            ? "operator"
            : node.type === "psu"
              ? "power"
              : "other";
  $("#cat-modal-group").value = guess;
  modal.classList.remove("hidden");
  $("#cat-modal-name")?.focus();
}

// ── Properties panel ──
function renderProps() {
  const sel = state.selection;
  if (!sel) {
    propsEmpty.classList.remove("hidden");
    propsForm.classList.add("hidden");
    propsForm.innerHTML = "";
    return;
  }

  propsEmpty.classList.add("hidden");
  propsForm.classList.remove("hidden");

  if (sel.type === "node") {
    const node = state.project.nodes.find((n) => n.id === sel.id);
    if (!node) {
      state.selection = null;
      renderProps();
      return;
    }
    propsForm.innerHTML = nodePropsHtml(node);
    bindNodeProps(node);
  } else if (sel.type === "cable") {
    const cable = state.project.cables.find((c) => c.id === sel.id);
    if (!cable) {
      state.selection = null;
      renderProps();
      return;
    }
    propsForm.innerHTML = cablePropsHtml(cable);
    bindCableProps(cable);
  }
}

function nodePropsHtml(node) {
  const terms = (node.terminals || [])
    .map(
      (t, i) => `
      <div class="term-row" data-idx="${i}">
        <span class="term-num">${i + 1}</span>
        <input type="text" data-field="term-name" data-tid="${escapeAttr(t.id)}" value="${escapeAttr(t.name)}" placeholder="Landing name" />
        <button type="button" class="btn-icon" data-action="del-term" data-tid="${escapeAttr(t.id)}" title="Remove">×</button>
      </div>
      <div class="term-row" style="grid-template-columns:48px 1fr;margin-top:-4px;margin-bottom:4px">
        <span class="term-num" style="font-size:9px;color:var(--text-dim)">ID</span>
        <input type="text" data-field="term-id" data-tid="${escapeAttr(t.id)}" value="${escapeAttr(t.id)}" />
      </div>
    `
    )
    .join("");

  return `
    <div><span class="badge ${node.category}">${node.category}</span></div>
    <div class="field-row">
      <div class="field">
        <label>Tag</label>
        <input type="text" id="pf-tag" value="${escapeAttr(node.tag)}" />
      </div>
      <div class="field">
        <label>Type</label>
        <input type="text" value="${escapeAttr(node.type)}" disabled />
      </div>
    </div>
    <div class="field">
      <label>Name / description</label>
      <input type="text" id="pf-name" value="${escapeAttr(node.name)}" />
    </div>
    <div class="field">
      <label>Location</label>
      <input type="text" id="pf-location" value="${escapeAttr(node.location || "")}" placeholder="e.g. Main panel, Field JB-2" />
    </div>
    <div class="field-row">
      <div class="field">
        <label>Manufacturer</label>
        <input type="text" id="pf-mfr" value="${escapeAttr(node.manufacturer || "")}" />
      </div>
      <div class="field">
        <label>Part number</label>
        <input type="text" id="pf-pn" value="${escapeAttr(node.partNumber || "")}" />
      </div>
    </div>
    <div class="field">
      <label>Notes</label>
      <textarea id="pf-notes">${escapeAttr(node.description || "")}</textarea>
    </div>
    <div class="field">
      <label>Terminal landings</label>
      <div class="term-editor" id="term-editor">${terms}</div>
      <button type="button" class="btn-add-term" id="btn-add-term">+ Add terminal</button>
    </div>
    <button type="button" class="btn-catalog-save" id="btn-save-catalog">
      ${node.catalogId ? "Update device catalog" : "Save to device catalog"}
    </button>
    ${
      node.catalogName
        ? `<div class="hint" style="margin:4px 0 0">Catalog: ${escapeHtml(node.catalogName)}</div>`
        : ""
    }
  `;
}

function bindNodeProps(node) {
  const apply = (mutator) => {
    pushHistory();
    mutator();
    state.project.updatedAt = new Date().toISOString();
    render();
  };

  $("#pf-tag")?.addEventListener("change", (e) => {
    apply(() => {
      node.tag = e.target.value.trim() || node.tag;
    });
  });
  $("#pf-name")?.addEventListener("change", (e) => {
    apply(() => {
      node.name = e.target.value;
    });
  });
  $("#pf-location")?.addEventListener("change", (e) => {
    apply(() => {
      node.location = e.target.value;
    });
  });
  $("#pf-mfr")?.addEventListener("change", (e) => {
    apply(() => {
      node.manufacturer = e.target.value;
    });
  });
  $("#pf-pn")?.addEventListener("change", (e) => {
    apply(() => {
      node.partNumber = e.target.value;
    });
  });
  $("#pf-notes")?.addEventListener("change", (e) => {
    apply(() => {
      node.description = e.target.value;
    });
  });

  $("#btn-add-term")?.addEventListener("click", () => {
    apply(() => {
      const n = (node.terminals?.length || 0) + 1;
      node.terminals = node.terminals || [];
      node.terminals.push({ id: String(n), name: `Term ${n}` });
    });
  });

  $("#btn-save-catalog")?.addEventListener("click", () => {
    openSaveToCatalogModal(node);
  });

  propsForm.querySelectorAll('[data-action="del-term"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const tid = btn.dataset.tid;
      apply(() => {
        node.terminals = node.terminals.filter((t) => t.id !== tid);
        // clear cable refs to deleted terminal
        for (const c of state.project.cables) {
          if (c.from.nodeId === node.id && c.from.terminalId === tid) c.from.terminalId = node.terminals[0]?.id || "";
          if (c.to.nodeId === node.id && c.to.terminalId === tid) c.to.terminalId = node.terminals[0]?.id || "";
        }
      });
    });
  });

  propsForm.querySelectorAll('[data-field="term-name"]').forEach((inp) => {
    inp.addEventListener("change", () => {
      const tid = inp.dataset.tid;
      apply(() => {
        const t = node.terminals.find((x) => x.id === tid);
        if (t) t.name = inp.value;
      });
    });
  });

  propsForm.querySelectorAll('[data-field="term-id"]').forEach((inp) => {
    inp.addEventListener("change", () => {
      const oldId = inp.dataset.tid;
      const newId = inp.value.trim();
      if (!newId || newId === oldId) return;
      if (node.terminals.some((t) => t.id === newId)) {
        setStatus("Terminal ID already exists");
        inp.value = oldId;
        return;
      }
      apply(() => {
        const t = node.terminals.find((x) => x.id === oldId);
        if (t) t.id = newId;
        for (const c of state.project.cables) {
          if (c.from.nodeId === node.id && c.from.terminalId === oldId) c.from.terminalId = newId;
          if (c.to.nodeId === node.id && c.to.terminalId === oldId) c.to.terminalId = newId;
          for (const cond of c.conductors || []) {
            if (cond.fromTerminalId === oldId && c.from.nodeId === node.id) cond.fromTerminalId = newId;
            if (cond.toTerminalId === oldId && c.to.nodeId === node.id) cond.toTerminalId = newId;
          }
        }
      });
    });
  });
}

function cablePropsHtml(cable) {
  const nodes = state.project.nodes;
  const fromN = nodes.find((n) => n.id === cable.from.nodeId);
  const toN = nodes.find((n) => n.id === cable.to.nodeId);
  const fromOpts = terminalOptions(fromN, cable.from.terminalId);
  const toOpts = terminalOptions(toN, cable.to.terminalId);
  const colorOpts = WIRE_COLORS.map(
    (c) => `<option value="${c.id}">${c.id} — ${c.name}</option>`
  ).join("");

  const condRows = (cable.conductors || [])
    .map((cond, i) => {
      const colOpts = WIRE_COLORS.map(
        (c) =>
          `<option value="${c.id}" ${c.id === cond.color ? "selected" : ""}>${c.id}</option>`
      ).join("");
      return `
        <div class="conductor-row">
          <span class="c-num">${cond.index || i + 1}</span>
          <input type="text" data-cond="${i}" data-field="label" value="${escapeAttr(cond.label || "")}" placeholder="Label" />
          <select data-cond="${i}" data-field="color">${colOpts}</select>
          <select data-cond="${i}" data-field="fromT">${terminalOptions(fromN, cond.fromTerminalId || cable.from.terminalId)}</select>
          <select data-cond="${i}" data-field="toT">${terminalOptions(toN, cond.toTerminalId || cable.to.terminalId)}</select>
        </div>
      `;
    })
    .join("");

  const termBadge = cable.terminated
    ? `<span class="badge terminated">terminated</span>`
    : `<span class="badge cable">open / bulk</span>`;

  return `
    <div style="display:flex;gap:6px;flex-wrap:wrap">${termBadge}<span class="badge cable">${escapeHtml(cable.type || "cable")}</span></div>
    <div class="field-row">
      <div class="field">
        <label>Cable ID</label>
        <input type="text" id="cf-id" value="${escapeAttr(cable.cableId)}" />
      </div>
      <div class="field">
        <label>AWG</label>
        <input type="text" id="cf-awg" value="${escapeAttr(cable.awg || "")}" />
      </div>
    </div>
    <div class="field">
      <label>Name</label>
      <input type="text" id="cf-name" value="${escapeAttr(cable.name || "")}" />
    </div>
    <div class="field">
      <label>Part number (cordset)</label>
      <input type="text" id="cf-pn" value="${escapeAttr(cable.partNumber || "")}" placeholder="e.g. vendor P/N" />
    </div>
    <div class="field-row">
      <div class="field">
        <label>Type</label>
        <select id="cf-type">
          ${["Power", "Control", "Signal", "Sensor", "Network", "Other"]
            .map((t) => `<option ${t === cable.type ? "selected" : ""}>${t}</option>`)
            .join("")}
        </select>
      </div>
      <div class="field">
        <label>Length</label>
        <input type="text" id="cf-len" value="${escapeAttr(cable.length || "")}" placeholder="e.g. 5 m" />
      </div>
    </div>
    <div class="field">
      <label>Termination</label>
      <select id="cf-terminated">
        <option value="0" ${!cable.terminated ? "selected" : ""}>Open / bulk (not terminated)</option>
        <option value="1" ${cable.terminated ? "selected" : ""}>Terminated cordset</option>
      </select>
    </div>
    <div class="field-row">
      <div class="field">
        <label>End A (from)</label>
        <input type="text" id="cf-end-a" value="${escapeAttr(endLabel(cable.endA))}" placeholder="e.g. M12-4F" />
      </div>
      <div class="field">
        <label>End B (to)</label>
        <input type="text" id="cf-end-b" value="${escapeAttr(endLabel(cable.endB))}" placeholder="e.g. Flying leads" />
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>From landing</label>
        <div style="font-family:var(--mono);font-size:11px;margin-bottom:4px;color:var(--text-muted)">${escapeAttr(fromN?.tag || "?")}</div>
        <select id="cf-from-term">${fromOpts}</select>
      </div>
      <div class="field">
        <label>To landing</label>
        <div style="font-family:var(--mono);font-size:11px;margin-bottom:4px;color:var(--text-muted)">${escapeAttr(toN?.tag || "?")}</div>
        <select id="cf-to-term">${toOpts}</select>
      </div>
    </div>
    <div class="field">
      <label>Conductors (color · from · to)</label>
      <div class="conductor-list" id="cond-list">
        <div class="conductor-row" style="font-size:9px;color:var(--text-dim);text-transform:uppercase">
          <span>#</span><span>Label</span><span>Color</span><span>From term</span><span>To term</span>
        </div>
        ${condRows}
      </div>
      <button type="button" class="btn-add-term" id="btn-add-cond" style="margin-top:8px">+ Add conductor</button>
    </div>
    <div class="field">
      <label>Notes</label>
      <textarea id="cf-notes">${escapeAttr(cable.notes || "")}</textarea>
    </div>
  `;
}

function terminalOptions(node, selectedId) {
  if (!node) return `<option value="">—</option>`;
  return (node.terminals || [])
    .map(
      (t) =>
        `<option value="${escapeAttr(t.id)}" ${t.id === selectedId ? "selected" : ""}>${escapeAttr(t.id)} — ${escapeAttr(t.name)}</option>`
    )
    .join("");
}

function bindCableProps(cable) {
  const apply = (mutator) => {
    pushHistory();
    mutator();
    state.project.updatedAt = new Date().toISOString();
    render();
  };

  $("#cf-id")?.addEventListener("change", (e) => apply(() => (cable.cableId = e.target.value.trim() || cable.cableId)));
  $("#cf-awg")?.addEventListener("change", (e) => apply(() => (cable.awg = e.target.value)));
  $("#cf-name")?.addEventListener("change", (e) => apply(() => (cable.name = e.target.value)));
  $("#cf-pn")?.addEventListener("change", (e) => apply(() => (cable.partNumber = e.target.value)));
  $("#cf-type")?.addEventListener("change", (e) => apply(() => (cable.type = e.target.value)));
  $("#cf-len")?.addEventListener("change", (e) => apply(() => (cable.length = e.target.value)));
  $("#cf-notes")?.addEventListener("change", (e) => apply(() => (cable.notes = e.target.value)));
  $("#cf-terminated")?.addEventListener("change", (e) => {
    apply(() => {
      cable.terminated = e.target.value === "1";
      if (!cable.endA) cable.endA = { kind: "open", label: "Open / bulk" };
      if (!cable.endB) cable.endB = { kind: "open", label: "Open / bulk" };
      if (!cable.terminated) {
        cable.endA = { kind: "open", gender: null, pins: null, label: "Open / bulk" };
        cable.endB = { kind: "open", gender: null, pins: null, label: "Open / bulk" };
      }
    });
  });
  $("#cf-end-a")?.addEventListener("change", (e) => {
    apply(() => {
      cable.endA = cable.endA || {};
      cable.endA.label = e.target.value;
      cable.endA.kind = cable.endA.kind || "custom";
    });
  });
  $("#cf-end-b")?.addEventListener("change", (e) => {
    apply(() => {
      cable.endB = cable.endB || {};
      cable.endB.label = e.target.value;
      cable.endB.kind = cable.endB.kind || "custom";
    });
  });
  $("#cf-from-term")?.addEventListener("change", (e) => {
    apply(() => {
      cable.from.terminalId = e.target.value;
      for (const c of cable.conductors || []) {
        if (!c.fromTerminalId || c.fromTerminalId === cable.from.terminalId) {
          /* keep per-conductor */
        }
      }
    });
  });
  $("#cf-to-term")?.addEventListener("change", (e) => {
    apply(() => {
      cable.to.terminalId = e.target.value;
    });
  });

  propsForm.querySelectorAll("[data-cond]").forEach((el) => {
    el.addEventListener("change", () => {
      const i = parseInt(el.dataset.cond, 10);
      const field = el.dataset.field;
      apply(() => {
        const cond = cable.conductors[i];
        if (!cond) return;
        if (field === "label") cond.label = el.value;
        if (field === "color") cond.color = el.value;
        if (field === "fromT") cond.fromTerminalId = el.value;
        if (field === "toT") cond.toTerminalId = el.value;
      });
    });
  });

  $("#btn-add-cond")?.addEventListener("click", () => {
    apply(() => {
      cable.conductors = cable.conductors || [];
      cable.conductors.push({
        index: cable.conductors.length + 1,
        color: state.activeColorId,
        label: `W${cable.conductors.length + 1}`,
        fromTerminalId: cable.from.terminalId,
        toTerminalId: cable.to.terminalId,
      });
    });
  });
}

// ── Wire table ──
function renderWireTable() {
  const { cables, nodes } = state.project;
  if (!cables.length) {
    wireTableBody.innerHTML = `<tr class="empty-row"><td colspan="7">No cables yet</td></tr>`;
    return;
  }

  const rows = [];
  for (const cable of cables) {
    const fromN = nodes.find((n) => n.id === cable.from.nodeId);
    const toN = nodes.find((n) => n.id === cable.to.nodeId);
    const conds = cable.conductors?.length ? cable.conductors : [{ color: "GY", label: "—", index: 1, fromTerminalId: cable.from.terminalId, toTerminalId: cable.to.terminalId }];
    const ends =
      cable.terminated
        ? `${endLabel(cable.endA)} → ${endLabel(cable.endB)}`
        : "open";

    conds.forEach((cond, i) => {
      const col = colorById(cond.color);
      const fromRef = landingRef(fromN, cond.fromTerminalId || cable.from.terminalId);
      const toRef = landingRef(toN, cond.toTerminalId || cable.to.terminalId);
      const selected = state.selection?.type === "cable" && state.selection.id === cable.id;
      rows.push(`
        <tr data-cable-id="${cable.id}" class="${selected ? "selected" : ""}">
          <td>${i === 0 ? escapeHtml(cable.cableId) : ""}</td>
          <td>${escapeHtml(cond.label || String(cond.index || i + 1))}</td>
          <td><span class="color-chip"><i style="background:${col.hex}"></i>${escapeHtml(col.id)}</span></td>
          <td>${escapeHtml(fromRef)}</td>
          <td>${escapeHtml(toRef)}</td>
          <td>${i === 0 ? escapeHtml(cable.awg || "") : ""}</td>
          <td>${i === 0 ? `<span class="term-flag${cable.terminated ? " on" : ""}">${escapeHtml(ends)}</span>` : ""}</td>
        </tr>
      `);
    });
  }
  wireTableBody.innerHTML = rows.join("");
  wireTableBody.querySelectorAll("tr[data-cable-id]").forEach((tr) => {
    tr.addEventListener("click", () => {
      state.selection = { type: "cable", id: tr.dataset.cableId };
      render();
    });
  });
}

// ── Landing map ──
function renderLandings() {
  const { nodes, cables } = state.project;
  const focusIds = new Set();
  if (state.selection?.type === "node") focusIds.add(state.selection.id);
  if (state.selection?.type === "cable") {
    const c = cables.find((x) => x.id === state.selection.id);
    if (c) {
      focusIds.add(c.from.nodeId);
      focusIds.add(c.to.nodeId);
    }
  }

  let show = nodes;
  if (focusIds.size) {
    show = nodes.filter((n) => focusIds.has(n.id));
    landingContext.textContent = show.map((n) => n.tag).join(" · ");
  } else {
    show = nodes.slice(0, 6);
    landingContext.textContent = nodes.length
      ? `Showing ${show.length} of ${nodes.length} — select a node for detail`
      : "Select a node to view terminal map";
  }

  if (!show.length) {
    landingMap.innerHTML = `<div class="landing-placeholder">Place devices and junction boxes, then draw cables between terminals.</div>`;
    return;
  }

  // map terminal occupancy
  const occupancy = new Map(); // nodeId:termId -> [{cableId, color, other}]
  for (const cable of cables) {
    for (const cond of cable.conductors || []) {
      const fKey = `${cable.from.nodeId}:${cond.fromTerminalId || cable.from.terminalId}`;
      const tKey = `${cable.to.nodeId}:${cond.toTerminalId || cable.to.terminalId}`;
      const col = colorById(cond.color);
      const push = (key, otherNode, otherTerm) => {
        if (!occupancy.has(key)) occupancy.set(key, []);
        occupancy.get(key).push({
          cableId: cable.cableId,
          color: col,
          label: cond.label,
          other: landingRef(
            nodes.find((n) => n.id === otherNode),
            otherTerm
          ),
        });
      };
      push(fKey, cable.to.nodeId, cond.toTerminalId || cable.to.terminalId);
      push(tKey, cable.from.nodeId, cond.fromTerminalId || cable.from.terminalId);
    }
  }

  landingMap.innerHTML = show
    .map((node) => {
      const terms = (node.terminals || [])
        .map((t) => {
          const occ = occupancy.get(`${node.id}:${t.id}`) || [];
          const empty = !occ.length;
          const wireInfo = occ
            .map((o) => `${o.cableId} ${o.label || ""} → ${o.other}`)
            .join("; ");
          const border = occ[0]?.color?.stroke || "var(--border-strong)";
          return `
            <div class="lt-term${empty ? " empty" : ""}" style="border-left-color:${border}">
              <span class="lt-id">${escapeHtml(t.id)}</span>
              <span class="lt-name">${escapeHtml(t.name)}</span>
              <span class="lt-wire">${empty ? "open" : escapeHtml(wireInfo)}</span>
            </div>
          `;
        })
        .join("");

      return `
        <div class="landing-card" data-node-id="${node.id}">
          <header>
            <span class="lc-title">${escapeHtml(node.tag)} — ${escapeHtml(node.name)}</span>
            <span class="badge ${node.category}">${node.category}</span>
          </header>
          <div class="lc-tag">${escapeHtml(node.location || node.type)}</div>
          <div class="landing-terminals">${terms}</div>
        </div>
      `;
    })
    .join("");

  landingMap.querySelectorAll(".landing-card").forEach((card) => {
    card.addEventListener("click", () => {
      state.selection = { type: "node", id: card.dataset.nodeId };
      setTool("select");
      render();
    });
  });
}

// ── Interactions ──
function onPointerDown(e) {
  if (e.button !== 0) return;
  const world = screenToWorld(svg, state.project.view, e.clientX, e.clientY);

  if (state.tool === "pan" || e.spaceKey || e.button === 1) {
    state.panning = {
      sx: e.clientX,
      sy: e.clientY,
      vx: state.project.view.x,
      vy: state.project.view.y,
    };
    canvasContainer.classList.add("panning");
    return;
  }

  if (state.tool === "place" && state.placeCatalogId) {
    placeCatalogItemAt(state.placeCatalogId, world.x, world.y);
    return;
  }

  if (state.tool === "place" && state.placeType) {
    placeComponentAt(state.placeType, world.x, world.y);
    return;
  }

  // Terminal hit for cable tool
  const termHit = findTerminalAt(state.project.nodes, world.x, world.y, 14);

  if (state.tool === "cable") {
    if (termHit) {
      if (!state.cableFrom) {
        state.cableFrom = {
          nodeId: termHit.nodeId,
          terminalId: termHit.terminalId,
          x: termHit.x,
          y: termHit.y,
        };
        state.selection = {
          type: "cable-end",
          nodeId: termHit.nodeId,
          terminalId: termHit.terminalId,
        };
        render();
        setStatus(`Cable from ${termHit.node.tag}:${termHit.terminalId} — click destination terminal`);
      } else {
        if (
          state.cableFrom.nodeId === termHit.nodeId &&
          state.cableFrom.terminalId === termHit.terminalId
        ) {
          setStatus("Pick a different terminal");
          return;
        }
        pushHistory();
        const cable = createCableFromTemplate(
          state.cableTemplateId,
          state.cableFrom,
          { nodeId: termHit.nodeId, terminalId: termHit.terminalId },
          state.project.cables
        );
        assignConductorLandings(cable, state.cableFrom, termHit);
        state.project.cables.push(cable);
        state.cableFrom = null;
        state.selection = { type: "cable", id: cable.id };
        layers.overlay.innerHTML = "";
        state.project.updatedAt = new Date().toISOString();
        render();
        const mateNote = [
          cable.from.bulkheadTag && `${cable.from.bulkheadTag}:${cable.from.mateSide || "mate"}`,
          cable.to.bulkheadTag && `${cable.to.bulkheadTag}:${cable.to.mateSide || "mate"}`,
        ]
          .filter(Boolean)
          .join(" → ");
        setStatus(
          mateNote
            ? `Cable ${cable.cableId} mated (${mateNote})`
            : `Cable ${cable.cableId} created`
        );
      }
    } else {
      // cancel start if click empty
      if (state.cableFrom) {
        state.cableFrom = null;
        state.selection = null;
        layers.overlay.innerHTML = "";
        render();
        setStatus("Cable cancelled");
      }
    }
    return;
  }

  // Select / drag
  if (termHit && e.shiftKey) {
    // shift+click terminal starts cable quickly
    state.cableFrom = {
      nodeId: termHit.nodeId,
      terminalId: termHit.terminalId,
      x: termHit.x,
      y: termHit.y,
    };
    setTool("cable");
    state.selection = {
      type: "cable-end",
      nodeId: termHit.nodeId,
      terminalId: termHit.terminalId,
    };
    render();
    return;
  }

  // cable path hit
  const cableTarget = e.target.closest?.("[data-cable-id]") || (e.target.dataset?.cableId ? e.target : null);
  if (cableTarget?.dataset?.cableId) {
    state.selection = { type: "cable", id: cableTarget.dataset.cableId };
    render();
    return;
  }

  const node = findNodeAt(state.project.nodes, world.x, world.y);
  if (node) {
    state.selection = { type: "node", id: node.id };
    state.dragging = {
      nodeId: node.id,
      ox: world.x - node.x,
      oy: world.y - node.y,
      moved: false,
    };
    render();
    return;
  }

  state.selection = null;
  render();
}

function assignConductorLandings(cable, from, toHit) {
  const fromNode = state.project.nodes.find((n) => n.id === from.nodeId);
  const toNode = state.project.nodes.find((n) => n.id === toHit.nodeId);
  if (!fromNode || !toNode) return;

  // Bulkhead / connector-aware pin mating for terminated cordsets
  mapCableLandingsToNodes(
    cable,
    fromNode,
    from.terminalId,
    toNode,
    toHit.terminalId
  );

  // If primary click was on any field pin of a bulkhead, snap primary endpoint
  // to F1 (or first field pin) for cleaner cable routing visual
  if (fromNode.category === "connector") {
    const side = mateSideFromTerminalId(from.terminalId);
    if (side === "field" || side === "panel") {
      const pref = side === "field" ? "F1" : "P1";
      if (fromNode.terminals.some((t) => t.id === pref)) {
        cable.from.terminalId = pref;
      }
    }
  }
  if (toNode.category === "connector") {
    const side = mateSideFromTerminalId(toHit.terminalId);
    if (side === "field" || side === "panel") {
      const pref = side === "field" ? "F1" : "P1";
      if (toNode.terminals.some((t) => t.id === pref)) {
        cable.to.terminalId = pref;
      }
    }
  }
}

function onPointerMove(e) {
  const world = screenToWorld(svg, state.project.view, e.clientX, e.clientY);
  cursorPos.textContent = `${Math.round(world.x)}, ${Math.round(world.y)}`;

  if (state.panning) {
    const dx = e.clientX - state.panning.sx;
    const dy = e.clientY - state.panning.sy;
    setView({
      ...state.project.view,
      x: state.panning.vx + dx,
      y: state.panning.vy + dy,
    });
    return;
  }

  if (state.dragging) {
    const node = state.project.nodes.find((n) => n.id === state.dragging.nodeId);
    if (node) {
      if (!state.dragging.moved) {
        pushHistory();
        state.dragging.moved = true;
      }
      node.x = Math.round(world.x - state.dragging.ox);
      node.y = Math.round(world.y - state.dragging.oy);
      renderDiagram(layers, state.project, state.selection, state.hoverTerm);
      renderLandings();
    }
    return;
  }

  const termHit = findTerminalAt(state.project.nodes, world.x, world.y, 12);
  const prev = state.hoverTerm;
  state.hoverTerm = termHit
    ? { nodeId: termHit.nodeId, terminalId: termHit.terminalId }
    : null;
  if (
    prev?.nodeId !== state.hoverTerm?.nodeId ||
    prev?.terminalId !== state.hoverTerm?.terminalId
  ) {
    renderDiagram(layers, state.project, state.selection, state.hoverTerm);
  }

  if (state.tool === "cable" && state.cableFrom) {
    renderCablePreview(layers.overlay, state.cableFrom, world);
  }
}

function onPointerUp() {
  if (state.panning) {
    state.panning = null;
    canvasContainer.classList.remove("panning");
  }
  if (state.dragging) {
    if (state.dragging.moved) {
      state.project.updatedAt = new Date().toISOString();
      persistDebounced();
    }
    state.dragging = null;
  }
}

function onWheel(e) {
  e.preventDefault();
  const view = state.project.view;
  const worldBefore = screenToWorld(svg, view, e.clientX, e.clientY);
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  const newScale = Math.min(3, Math.max(0.2, view.scale * factor));
  // zoom toward cursor
  const rect = svg.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const newX = sx - worldBefore.x * newScale;
  const newY = sy - worldBefore.y * newScale;
  setView({ x: newX, y: newY, scale: newScale });
  renderDiagram(layers, state.project, state.selection, state.hoverTerm);
}

function deleteSelection() {
  if (!state.selection) return;
  pushHistory();
  if (state.selection.type === "node") {
    const id = state.selection.id;
    state.project.nodes = state.project.nodes.filter((n) => n.id !== id);
    state.project.cables = state.project.cables.filter(
      (c) => c.from.nodeId !== id && c.to.nodeId !== id
    );
  } else if (state.selection.type === "cable") {
    state.project.cables = state.project.cables.filter((c) => c.id !== state.selection.id);
  }
  state.selection = null;
  state.project.updatedAt = new Date().toISOString();
  render();
  setStatus("Deleted");
}

// ── Import / export ──
// ── Print / PDF ──
function fillPrintMeta() {
  const p = state.project;
  const title = p.name || projectNameInput.value || "Wiring Diagram";
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set("print-title", title);
  set("print-drawing", p.meta?.drawingNumber || "WD-001");
  set("print-rev", p.meta?.revision || "A");
  set("print-date", new Date().toLocaleDateString());
  set("print-cable-count", String(p.cables?.length || 0));

  const body = document.getElementById("print-wire-body");
  if (!body) return;
  const { cables, nodes } = p;
  if (!cables.length) {
    body.innerHTML = `<tr><td colspan="10">No cables</td></tr>`;
    return;
  }
  const rows = [];
  for (const cable of cables) {
    const fromN = nodes.find((n) => n.id === cable.from.nodeId);
    const toN = nodes.find((n) => n.id === cable.to.nodeId);
    const conds = cable.conductors?.length ? cable.conductors : [{ label: "—", color: "GY" }];
    conds.forEach((cond, i) => {
      const col = colorById(cond.color);
      rows.push(`
        <tr>
          <td>${i === 0 ? escapeHtml(cable.cableId) : ""}</td>
          <td>${i === 0 ? (cable.terminated ? "yes" : "no") : ""}</td>
          <td>${i === 0 ? escapeHtml(endLabel(cable.endA)) : ""}</td>
          <td>${i === 0 ? escapeHtml(endLabel(cable.endB)) : ""}</td>
          <td>${escapeHtml(cond.label || String(i + 1))}</td>
          <td>${escapeHtml(col.id)} ${escapeHtml(col.name)}</td>
          <td>${escapeHtml(landingRef(fromN, cond.fromTerminalId || cable.from.terminalId))}</td>
          <td>${escapeHtml(landingRef(toN, cond.toTerminalId || cable.to.terminalId))}</td>
          <td>${i === 0 ? escapeHtml(cable.awg || "") : ""}</td>
          <td>${i === 0 ? escapeHtml(cable.length || "") : ""}</td>
        </tr>
      `);
    });
  }
  body.innerHTML = rows.join("");
}

function preparePrintLayout() {
  // Idempotent: beforeprint + printToPdf may both fire
  if (state.printRestore) {
    fillPrintMeta();
    return;
  }

  // Save interactive viewport so we can restore after print
  state.printRestore = {
    view: { ...state.project.view },
    viewBox: svg.getAttribute("viewBox"),
    transform: viewportEl.getAttribute("transform") || "",
    hadViewBox: svg.hasAttribute("viewBox"),
  };

  fillPrintMeta();
  document.body.classList.add("printing");

  // Fit diagram to content in SVG user units (ignore pan/zoom)
  const bounds = contentBounds(state.project, 48);
  viewportEl.setAttribute("transform", "");
  svg.setAttribute(
    "viewBox",
    `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`
  );
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  // Re-render clean (no selection chrome)
  renderDiagram(layers, state.project, null, null);

  // Hide grid for cleaner print
  const grid = document.getElementById("grid-bg");
  if (grid) grid.style.display = "none";
}

function restorePrintLayout() {
  if (!state.printRestore && !document.body.classList.contains("printing")) {
    return;
  }

  document.body.classList.remove("printing");
  const grid = document.getElementById("grid-bg");
  if (grid) grid.style.display = "";

  const r = state.printRestore;
  state.printRestore = null;

  if (r) {
    if (r.hadViewBox && r.viewBox) svg.setAttribute("viewBox", r.viewBox);
    else svg.removeAttribute("viewBox");
    if (r.view) state.project.view = r.view;
    applyViewport(viewportEl, state.project.view);
  } else {
    applyViewport(viewportEl, state.project.view);
    svg.removeAttribute("viewBox");
  }
  render();
  setStatus("Print finished");
}

function printToPdf() {
  preparePrintLayout();
  setStatus("Print / PDF — choose Save as PDF in the dialog");
  // Allow layout paint before native print dialog
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.print();
      // Safari / some engines may not fire afterprint reliably
      setTimeout(() => {
        if (document.body.classList.contains("printing") || state.printRestore) {
          restorePrintLayout();
        }
      }, 800);
    });
  });
}

function exportJSON() {
  state.project.name = projectNameInput.value || state.project.name;
  state.project.updatedAt = new Date().toISOString();
  const blob = new Blob([JSON.stringify(state.project, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${slug(state.project.name)}-wiring.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus("Exported JSON");
}

function exportCSV() {
  const { cables, nodes } = state.project;
  const lines = [
    [
      "Cable ID",
      "Terminated",
      "End A",
      "End B",
      "Part Number",
      "Conductor",
      "Color",
      "Color Name",
      "Pin A",
      "Pin B",
      "From",
      "To",
      "AWG",
      "Type",
      "Length",
      "Notes",
    ].join(","),
  ];
  for (const cable of cables) {
    const fromN = nodes.find((n) => n.id === cable.from.nodeId);
    const toN = nodes.find((n) => n.id === cable.to.nodeId);
    for (const cond of cable.conductors || []) {
      const col = colorById(cond.color);
      lines.push(
        [
          csv(cable.cableId),
          csv(cable.terminated ? "yes" : "no"),
          csv(endLabel(cable.endA)),
          csv(endLabel(cable.endB)),
          csv(cable.partNumber || ""),
          csv(cond.label),
          csv(col.id),
          csv(col.name),
          csv(cond.pinA || ""),
          csv(cond.pinB || ""),
          csv(landingRef(fromN, cond.fromTerminalId || cable.from.terminalId)),
          csv(landingRef(toN, cond.toTerminalId || cable.to.terminalId)),
          csv(cable.awg),
          csv(cable.type),
          csv(cable.length),
          csv(cable.notes),
        ].join(",")
      );
    }
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${slug(state.project.name)}-wire-list.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus("Exported wire list CSV");
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.nodes || !data.cables) throw new Error("Invalid project file");
      pushHistory();
      state.project = {
        ...createEmptyProject(),
        ...data,
        nodes: data.nodes || [],
        cables: data.cables || [],
        view: data.view || { x: 0, y: 0, scale: 1 },
      };
      state.selection = null;
      render();
      setStatus("Imported project");
    } catch (err) {
      setStatus("Import failed");
      alert("Could not import file: " + err.message);
    }
  };
  reader.readAsText(file);
}

function newProject() {
  if (state.dirty && !confirm("Start a new project? Unsaved changes may be lost (export first if needed).")) {
    return;
  }
  state.project = createEmptyProject();
  state.selection = null;
  state.history = [];
  state.future = [];
  state.dirty = false;
  seedDemo();
  render();
  setStatus("New project");
}

// ── Persistence ──
let persistTimer;
function persistDebounced() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      state.project.name = projectNameInput.value || state.project.name;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.project));
    } catch {
      /* quota */
    }
  }, 400);
}

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data.nodes) return false;
    state.project = { ...createEmptyProject(), ...data };
    return true;
  } catch {
    return false;
  }
}

// ── Demo seed ──
function seedDemo() {
  const p = state.project;
  p.name = "Demo Packer Line";
  p.meta.drawingNumber = "WD-DEMO-001";

  const plc = createNode("plc", 80, 120, p.nodes);
  plc.tag = "PLC1";
  plc.name = "Main PLC";
  plc.location = "Control panel CP-1";
  p.nodes.push(plc);

  const psu = createNode("psu", 80, 280, p.nodes);
  psu.tag = "PS1";
  psu.name = "24V PSU";
  p.nodes.push(psu);

  const jb = createNode("jbox", 360, 160, p.nodes);
  jb.tag = "JB1";
  jb.name = "Field junction";
  jb.location = "Machine frame";
  p.nodes.push(jb);

  const sensor = createNode("sensor", 580, 100, p.nodes);
  sensor.tag = "B1";
  sensor.name = "Infeed photoeye";
  p.nodes.push(sensor);

  const motor = createNode("motor", 580, 260, p.nodes);
  motor.tag = "M1";
  motor.name = "Conveyor motor";
  p.nodes.push(motor);

  const vfd = createNode("vfd", 360, 300, p.nodes);
  vfd.tag = "VFD1";
  vfd.name = "Conveyor drive";
  p.nodes.push(vfd);

  const xt = createNode("termstrip", 80, 40, p.nodes);
  xt.tag = "XT1";
  xt.name = "Panel terminal strip";
  p.nodes.push(xt);

  // Power PSU to PLC
  const c1 = createCableFromTemplate(
    "2c-control",
    { nodeId: psu.id, terminalId: "+V" },
    { nodeId: plc.id, terminalId: "L+" },
    p.cables
  );
  c1.cableId = "C001";
  c1.conductors[0].fromTerminalId = "+V";
  c1.conductors[0].toTerminalId = "L+";
  c1.conductors[0].color = "RD";
  c1.conductors[0].label = "+24V";
  c1.conductors[1].fromTerminalId = "0V";
  c1.conductors[1].toTerminalId = "M";
  c1.conductors[1].color = "BU";
  c1.conductors[1].label = "0V";
  c1.from.terminalId = "+V";
  c1.to.terminalId = "L+";
  p.cables.push(c1);

  // Sensor via JB
  const c2 = createCableFromTemplate(
    "sensor-3w",
    { nodeId: sensor.id, terminalId: "1" },
    { nodeId: jb.id, terminalId: "1" },
    p.cables
  );
  c2.cableId = "C002";
  c2.length = "8 ft";
  assignConductorLandings(c2, { nodeId: sensor.id, terminalId: "1" }, { nodeId: jb.id, terminalId: "1", terminal: { id: "1" } });
  // manual better mapping
  c2.conductors[0].fromTerminalId = "1";
  c2.conductors[0].toTerminalId = "1";
  c2.conductors[1].fromTerminalId = "4";
  c2.conductors[1].toTerminalId = "2";
  c2.conductors[2].fromTerminalId = "3";
  c2.conductors[2].toTerminalId = "3";
  p.cables.push(c2);

  const c3 = createCableFromTemplate(
    "sensor-3w",
    { nodeId: jb.id, terminalId: "1" },
    { nodeId: plc.id, terminalId: "DI0" },
    p.cables
  );
  c3.cableId = "C003";
  c3.conductors[0].fromTerminalId = "1";
  c3.conductors[0].toTerminalId = "L+";
  c3.conductors[0].label = "+V";
  c3.conductors[0].color = "BN";
  c3.conductors[1].fromTerminalId = "2";
  c3.conductors[1].toTerminalId = "DI0";
  c3.conductors[1].label = "OUT";
  c3.conductors[1].color = "BK";
  c3.conductors[2].fromTerminalId = "3";
  c3.conductors[2].toTerminalId = "M";
  c3.conductors[2].label = "0V";
  c3.conductors[2].color = "BU";
  c3.from.terminalId = "1";
  c3.to.terminalId = "DI0";
  p.cables.push(c3);

  // Motor power
  const c4 = createCableFromTemplate(
    "4c-3ph",
    { nodeId: vfd.id, terminalId: "U" },
    { nodeId: motor.id, terminalId: "U1" },
    p.cables
  );
  c4.cableId = "C004";
  c4.length = "12 ft";
  c4.conductors[0].fromTerminalId = "U";
  c4.conductors[0].toTerminalId = "U1";
  c4.conductors[1].fromTerminalId = "V";
  c4.conductors[1].toTerminalId = "V1";
  c4.conductors[2].fromTerminalId = "W";
  c4.conductors[2].toTerminalId = "W1";
  c4.conductors[3].fromTerminalId = "PE";
  c4.conductors[3].toTerminalId = "PE";
  c4.from.terminalId = "U";
  c4.to.terminalId = "U1";
  p.cables.push(c4);

  state.dirty = false;
}

// ── Utils ──
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function csv(s) {
  const v = String(s ?? "");
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function slug(s) {
  return String(s || "project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "project";
}

// ── Keyboard ──
function onKeyDown(e) {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === "z" && !e.shiftKey) {
    e.preventDefault();
    undo();
    return;
  }
  if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
    e.preventDefault();
    redo();
    return;
  }
  if (e.key === "Delete" || e.key === "Backspace") {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
    e.preventDefault();
    deleteSelection();
    return;
  }
  if (e.key === "v" || e.key === "V") {
    if (isTyping()) return;
    setTool("select");
  }
  if (e.key === "h" || e.key === "H") {
    if (isTyping()) return;
    setTool("pan");
  }
  if (e.key === "c" || e.key === "C") {
    if (isTyping()) return;
    setTool("cable");
  }
  if (e.key === "Escape") {
    state.cableFrom = null;
    state.placeType = null;
    layers.overlay.innerHTML = "";
    setTool("select");
    render();
  }
  if (e.code === "Space" && !isTyping()) {
    e.preventDefault();
    canvasContainer.dataset.prevTool = state.tool;
    setTool("pan");
  }
}

function onKeyUp(e) {
  if (e.code === "Space") {
    const prev = canvasContainer.dataset.prevTool || "select";
    setTool(prev === "pan" ? "select" : prev);
  }
}

function isTyping() {
  const t = document.activeElement?.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT";
}

// ── Wire up UI ──
function bindUI() {
  $("#btn-select").addEventListener("click", () => setTool("select"));
  $("#btn-pan").addEventListener("click", () => setTool("pan"));
  $("#btn-cable").addEventListener("click", () => setTool("cable"));
  $("#btn-zoom-in").addEventListener("click", () => {
    const v = state.project.view;
    setView({ ...v, scale: Math.min(3, v.scale * 1.15) });
    render();
  });
  $("#btn-zoom-out").addEventListener("click", () => {
    const v = state.project.view;
    setView({ ...v, scale: Math.max(0.2, v.scale / 1.15) });
    render();
  });
  $("#btn-zoom-fit").addEventListener("click", () => {
    setView(fitView(svg, state.project));
    render();
  });
  $("#btn-undo").addEventListener("click", undo);
  $("#btn-redo").addEventListener("click", redo);
  $("#btn-delete").addEventListener("click", deleteSelection);
  $("#btn-new").addEventListener("click", newProject);
  $("#btn-export").addEventListener("click", exportJSON);
  $("#btn-export-csv").addEventListener("click", exportCSV);
  $("#btn-print").addEventListener("click", () => printToPdf());
  window.addEventListener("beforeprint", preparePrintLayout);
  window.addEventListener("afterprint", restorePrintLayout);
  $("#btn-import").addEventListener("click", () => fileImport.click());
  fileImport.addEventListener("change", () => {
    const f = fileImport.files?.[0];
    if (f) importJSON(f);
    fileImport.value = "";
  });
  projectNameInput.addEventListener("change", () => {
    pushHistory();
    state.project.name = projectNameInput.value;
    persistDebounced();
  });

  svg.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  svg.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // Drag-and-drop bulkhead / components onto canvas
  canvasContainer.addEventListener("dragover", (e) => {
    const types = [...e.dataTransfer.types];
    if (
      types.includes("application/x-raiv-component") ||
      types.includes("application/x-raiv-catalog") ||
      types.includes("text/plain")
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      canvasContainer.classList.add("drop-target");
    }
  });
  canvasContainer.addEventListener("dragleave", () => {
    canvasContainer.classList.remove("drop-target");
  });
  canvasContainer.addEventListener("drop", (e) => {
    e.preventDefault();
    canvasContainer.classList.remove("drop-target");
    const world = screenToWorld(svg, state.project.view, e.clientX, e.clientY);
    const catalogId = e.dataTransfer.getData("application/x-raiv-catalog");
    if (catalogId) {
      placeCatalogItemAt(catalogId, world.x, world.y);
      return;
    }
    const raw =
      e.dataTransfer.getData("application/x-raiv-component") ||
      e.dataTransfer.getData("text/plain");
    if (!raw) return;
    if (String(raw).startsWith("catalog:")) {
      placeCatalogItemAt(String(raw).slice("catalog:".length), world.x, world.y);
      return;
    }
    placeComponentAt(raw, world.x, world.y);
  });

  modalCancel.addEventListener("click", () => modal.classList.add("hidden"));
  modalOk.addEventListener("click", () => modal.classList.add("hidden"));
}

// ── Init ──
function init() {
  buildPalette();
  bindUI();
  const loaded = loadPersisted();
  if (!loaded || !state.project.nodes.length) {
    seedDemo();
  }
  setTool("select");
  render();
  // fit after layout
  requestAnimationFrame(() => {
    if (!loaded) setView(fitView(svg, state.project));
    else applyViewport(viewportEl, state.project.view);
    render();
    setStatus(loaded ? "Restored last session" : "Demo project loaded — edit or start New");
  });
}

init();
