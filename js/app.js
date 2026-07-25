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
  cableEndpoints,
  getCableRouteHandle,
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
  exportCatalogExcel,
  exportCatalogCsv,
  importCatalogFile,
  resetCatalogToDefaults,
  restoreSeedCatalog,
  ensureSeedItems,
  INVENTORY_GROUPS,
  getCatalogItems,
} from "./catalog.js";

import {
  loadGitHubSettings,
  saveGitHubSettings,
  isGitHubConfigured,
  canPullFromGitHub,
  testGitHubConnection,
  syncToGitHub,
  pullFromGitHub,
  mergeProjectLibraries,
} from "./github-sync.js";

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
  cableDragging: null, // { cableId, moved }
  panning: null, // { sx, sy, vx, vy }
  history: [],
  future: [],
  dirty: false,
  printRestore: null,
  placeCatalogId: null, // inventory catalog item to place
  catalogFilter: "",
  /** @type {{ activeId: string, projects: Record<string, object> }} */
  library: { activeId: "", projects: {} },
  /** Terminal landings drawer: collapsed | mid | tall */
  landingsMode: "collapsed",
  /** focus = selection-driven; all = every device */
  landingsFilter: "focus",
  /** Never auto-open landings on canvas selection — user opens via Landings / L / bottom bar */
  landingsAutoOpen: false,
  /** Sidebar wire list compact section open/closed */
  wireListSideOpen: false,
  /** Full wire list drawer open */
  wireListDrawerOpen: false,
  /** mid | tall */
  wireListDrawerSize: "mid",
};

const STORAGE_KEY = "raiv-wire-project-v1"; // legacy single-project key
const LIBRARY_KEY = "raiv-wire-library-v1"; // multi-project library

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
const wireTableDrawerBody = $("#wire-table-drawer-body");
const landingMap = $("#landing-map");
const landingContext = $("#landing-context");
const landingBar = $("#landing-bar");
const landingStats = $("#landing-stats");
const LANDINGS_PREF_KEY = "raiv-wire-landings-pref-v1";
const WIRELIST_PREF_KEY = "raiv-wire-wirelist-pref-v1";
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
let _statusClearTimer = null;
function setStatus(msg, kind = "") {
  const el = statusMsg || document.getElementById("status-msg");
  if (!el) {
    console.log("[status]", msg);
    return;
  }
  el.textContent = msg;
  el.classList.remove("status-ok", "status-warn", "status-err", "status-busy");
  if (kind) el.classList.add(`status-${kind}`);
  el.title = msg;
  // Keep success/warn visible longer so it isn't missed
  clearTimeout(_statusClearTimer);
  if (kind === "ok" || kind === "warn") {
    _statusClearTimer = setTimeout(() => {
      el.classList.remove("status-ok", "status-warn");
    }, 8000);
  }
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
  // Keep active project label in sync (device counts, name)
  const sel = $("#project-switcher");
  if (sel && state.project?.id) {
    const opt = [...sel.options].find((o) => o.value === state.project.id);
    if (opt) {
      const count = (state.project.nodes || []).length;
      const label = `${state.project.name || "Untitled"} (${count} devices)`;
      if (opt.textContent !== label) opt.textContent = label;
    }
  }
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

  const downloadBlob = (blob, filename) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  $("#btn-catalog-export-excel")?.addEventListener("click", async () => {
    try {
      setStatus("Building Excel catalog…");
      const blob = await exportCatalogExcel();
      downloadBlob(blob, "raiv-wire-device-catalog.xlsx");
      setStatus("Catalog exported as Excel (.xlsx)");
    } catch (err) {
      // Offline fallback: CSV opens in Excel
      console.warn(err);
      const csv = exportCatalogCsv();
      downloadBlob(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
        "raiv-wire-device-catalog.csv"
      );
      setStatus("Excel library unavailable — exported CSV (opens in Excel)");
      alert(
        "Could not build .xlsx (needs network once for the Excel library).\n\nA CSV file was downloaded instead — Excel can open and save it.\n\n" +
          (err.message || "")
      );
    }
  });

  $("#btn-catalog-export-json")?.addEventListener("click", () => {
    downloadBlob(
      new Blob([exportCatalogJson()], { type: "application/json" }),
      "raiv-wire-device-catalog.json"
    );
    setStatus("Catalog exported as JSON");
  });

  $("#btn-catalog-export-csv")?.addEventListener("click", () => {
    downloadBlob(
      new Blob([exportCatalogCsv()], { type: "text/csv;charset=utf-8" }),
      "raiv-wire-device-catalog.csv"
    );
    setStatus("Catalog exported as CSV (Excel)");
  });

  // legacy single Export button if present
  $("#btn-catalog-export")?.addEventListener("click", async () => {
    $("#btn-catalog-export-excel")?.click();
  });

  $("#btn-catalog-import")?.addEventListener("click", () => {
    $("#file-catalog-import")?.click();
  });

  $("#file-catalog-import")?.addEventListener("change", async () => {
    const f = $("#file-catalog-import")?.files?.[0];
    if (!f) return;
    const modeAns = prompt(
      `Import "${f.name}" into device catalog.\n\nType:\n  merge   — update matching items, add new\n  replace — replace entire catalog with this file\n\nLeave blank or cancel to abort.`,
      "merge"
    );
    if (modeAns === null || !String(modeAns).trim()) {
      $("#file-catalog-import").value = "";
      setStatus("Import cancelled");
      return;
    }
    const mode = String(modeAns).trim().toLowerCase().startsWith("r")
      ? "replace"
      : "merge";
    try {
      setStatus(`Importing catalog (${f.name})…`);
      await importCatalogFile(f, mode);
      renderCatalogPalette();
      setStatus(`Catalog imported from ${f.name} (${mode})`);
    } catch (err) {
      alert("Catalog import failed: " + err.message);
      setStatus("Catalog import failed");
    }
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
      <label>Route layout</label>
      <p class="hint" style="margin:0 0 6px">Cables stub out from terminals first, then bend. Click-hold and drag the cable (or blue handle) to adjust the mid route.</p>
      <button type="button" class="btn-secondary" id="cf-reset-route">Reset cable route</button>
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
  $("#cf-reset-route")?.addEventListener("click", () => {
    apply(() => {
      cable.route = null;
    });
    setStatus(`Cable ${cable.cableId} route reset to default`);
  });
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

// ── Wire list (sidebar + expandable drawer) ──
function loadWireListPrefs() {
  try {
    const raw = localStorage.getItem(WIRELIST_PREF_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (typeof p.sideOpen === "boolean") state.wireListSideOpen = p.sideOpen;
    if (typeof p.drawerOpen === "boolean") state.wireListDrawerOpen = p.drawerOpen;
    if (p.drawerSize === "mid" || p.drawerSize === "tall") state.wireListDrawerSize = p.drawerSize;
    if (typeof p.customH === "number" && p.customH > 120) state.wireListCustomH = p.customH;
  } catch {
    /* ignore */
  }
}

function saveWireListPrefs() {
  try {
    localStorage.setItem(
      WIRELIST_PREF_KEY,
      JSON.stringify({
        sideOpen: state.wireListSideOpen,
        drawerOpen: state.wireListDrawerOpen,
        drawerSize: state.wireListDrawerSize,
        customH: state.wireListCustomH || null,
      })
    );
  } catch {
    /* ignore */
  }
}

function applyWireListUi() {
  const section = $("#wire-list-section");
  const drawer = $("#wire-list-drawer");
  const panel = drawer?.querySelector(".wire-list-drawer-panel");

  section?.classList.toggle("is-open", !!state.wireListSideOpen);
  section?.classList.toggle("is-collapsed", !state.wireListSideOpen);
  $("#btn-wirelist-side-toggle")?.setAttribute(
    "aria-expanded",
    state.wireListSideOpen ? "true" : "false"
  );

  const open = !!state.wireListDrawerOpen;
  drawer?.classList.toggle("is-open", open);
  drawer?.classList.toggle("is-closed", !open);
  drawer?.classList.toggle("is-tall", state.wireListDrawerSize === "tall");
  drawer?.setAttribute("aria-hidden", open ? "false" : "true");
  $("#btn-wirelist")?.classList.toggle("wirelist-active", open);

  if (panel) {
    if (state.wireListCustomH) {
      panel.style.height = `${state.wireListCustomH}px`;
    } else {
      panel.style.height = "";
    }
  }
}

function setWireListSideOpen(open) {
  state.wireListSideOpen = !!open;
  applyWireListUi();
  saveWireListPrefs();
}

function setWireListDrawerOpen(open) {
  state.wireListDrawerOpen = !!open;
  if (open && !state.wireListDrawerSize) state.wireListDrawerSize = "mid";
  applyWireListUi();
  saveWireListPrefs();
  if (open) renderWireTable();
}

function toggleWireListDrawer() {
  setWireListDrawerOpen(!state.wireListDrawerOpen);
}

function cycleWireListDrawerSize() {
  state.wireListDrawerSize = state.wireListDrawerSize === "tall" ? "mid" : "tall";
  state.wireListCustomH = null;
  applyWireListUi();
  saveWireListPrefs();
}

function bindWireListUi() {
  loadWireListPrefs();
  // Drawer closed on load by default for canvas space (side can restore)
  state.wireListDrawerOpen = false;
  applyWireListUi();

  // Wire list open: landings slide button, sidebar expand, keyboard W
  $("#btn-wirelist-side-toggle")?.addEventListener("click", () => {
    setWireListSideOpen(!state.wireListSideOpen);
  });
  $("#btn-wirelist-expand")?.addEventListener("click", () => {
    setWireListDrawerOpen(true);
    setStatus("Wire list expanded");
  });
  $("#btn-wirelist-close")?.addEventListener("click", () => setWireListDrawerOpen(false));
  $("#wire-list-drawer-backdrop")?.addEventListener("click", () => setWireListDrawerOpen(false));
  $("#btn-wirelist-size")?.addEventListener("click", () => {
    cycleWireListDrawerSize();
    setStatus(
      state.wireListDrawerSize === "tall"
        ? "Wire list: tall"
        : "Wire list: medium"
    );
  });
  $("#btn-wirelist-export-csv")?.addEventListener("click", () => exportCSV());

  // Resize drawer
  const handle = $("#wire-list-drawer-resize");
  if (handle) {
    let dragging = false;
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      dragging = true;
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    handle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const fromBottom = window.innerHeight - e.clientY;
      state.wireListCustomH = Math.min(
        Math.max(fromBottom, 160),
        Math.floor(window.innerHeight * 0.9)
      );
      state.wireListDrawerSize =
        state.wireListCustomH > window.innerHeight * 0.6 ? "tall" : "mid";
      applyWireListUi();
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      saveWireListPrefs();
    };
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  }
}

function buildWireTableRows(includeExtra = false) {
  const { cables, nodes } = state.project;
  if (!cables.length) {
    const cols = includeExtra ? 9 : 7;
    return {
      count: 0,
      html: `<tr class="empty-row"><td colspan="${cols}">No cables yet</td></tr>`,
    };
  }

  const rows = [];
  let rowCount = 0;
  for (const cable of cables) {
    const fromN = nodes.find((n) => n.id === cable.from.nodeId);
    const toN = nodes.find((n) => n.id === cable.to.nodeId);
    const conds = cable.conductors?.length
      ? cable.conductors
      : [
          {
            color: "GY",
            label: "—",
            index: 1,
            fromTerminalId: cable.from.terminalId,
            toTerminalId: cable.to.terminalId,
          },
        ];
    const ends = cable.terminated
      ? `${endLabel(cable.endA)} → ${endLabel(cable.endB)}`
      : "open";

    conds.forEach((cond, i) => {
      rowCount++;
      const col = colorById(cond.color);
      const fromRef = landingRef(
        fromN,
        cond.fromTerminalId || cable.from.terminalId
      );
      const toRef = landingRef(toN, cond.toTerminalId || cable.to.terminalId);
      const selected =
        state.selection?.type === "cable" && state.selection.id === cable.id;
      const extra =
        includeExtra
          ? `<td>${i === 0 ? escapeHtml(cable.type || "") : ""}</td>
             <td>${i === 0 ? escapeHtml(cable.length || "") : ""}</td>`
          : "";
      rows.push(`
        <tr data-cable-id="${cable.id}" class="${selected ? "selected" : ""}">
          <td>${i === 0 ? escapeHtml(cable.cableId) : ""}</td>
          <td>${escapeHtml(cond.label || String(cond.index || i + 1))}</td>
          <td><span class="color-chip"><i style="background:${col.hex}"></i>${escapeHtml(col.id)}</span></td>
          <td>${escapeHtml(fromRef)}</td>
          <td>${escapeHtml(toRef)}</td>
          <td>${i === 0 ? escapeHtml(cable.awg || "") : ""}</td>
          <td>${i === 0 ? `<span class="term-flag${cable.terminated ? " on" : ""}">${escapeHtml(ends)}</span>` : ""}</td>
          ${extra}
        </tr>
      `);
    });
  }
  return { count: cables.length, rowCount, html: rows.join("") };
}

function bindWireTableClicks(tbody) {
  if (!tbody) return;
  tbody.querySelectorAll("tr[data-cable-id]").forEach((tr) => {
    tr.addEventListener("click", () => {
      state.selection = { type: "cable", id: tr.dataset.cableId };
      render();
    });
  });
}

function renderWireTable() {
  const side = buildWireTableRows(false);
  const full = buildWireTableRows(true);
  const n = side.count;
  const label = n === 1 ? "1 cable" : `${n} cables`;

  if (wireTableBody) {
    wireTableBody.innerHTML = side.html;
    bindWireTableClicks(wireTableBody);
  }
  if (wireTableDrawerBody) {
    wireTableDrawerBody.innerHTML = full.html;
    bindWireTableClicks(wireTableDrawerBody);
  }

  const countEl = $("#wire-list-count");
  const drawerCount = $("#wire-list-drawer-count");
  if (countEl) countEl.textContent = String(n);
  if (drawerCount) drawerCount.textContent = label;
}

// ── Terminal landings drawer ──
function loadLandingsPrefs() {
  try {
    const raw = localStorage.getItem(LANDINGS_PREF_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p.mode === "collapsed" || p.mode === "mid" || p.mode === "tall") {
      state.landingsMode = p.mode;
    }
    if (p.filter === "focus" || p.filter === "all") {
      state.landingsFilter = p.filter;
    }
    // autoOpen is always off (user must open landings manually)
    state.landingsAutoOpen = false;
    if (typeof p.customH === "number" && p.customH > 80) {
      state.landingsCustomH = p.customH;
    }
  } catch {
    /* ignore */
  }
}

function saveLandingsPrefs() {
  try {
    localStorage.setItem(
      LANDINGS_PREF_KEY,
      JSON.stringify({
        mode: state.landingsMode,
        filter: state.landingsFilter,
        autoOpen: false,
        customH: state.landingsCustomH || null,
      })
    );
  } catch {
    /* ignore */
  }
}

function applyLandingsMode() {
  const app = $("#app");
  if (!app || !landingBar) return;
  app.classList.remove("landings-collapsed", "landings-mid", "landings-tall");
  landingBar.classList.remove("is-open", "is-collapsed");

  const mode = state.landingsMode || "collapsed";
  if (mode === "collapsed") {
    app.classList.add("landings-collapsed");
    landingBar.classList.add("is-collapsed");
    app.style.removeProperty("--landing-h");
  } else if (mode === "tall") {
    app.classList.add("landings-tall");
    landingBar.classList.add("is-open");
    if (state.landingsCustomH) {
      app.style.setProperty("--landing-h", `${state.landingsCustomH}px`);
    } else {
      app.style.removeProperty("--landing-h");
    }
  } else {
    app.classList.add("landings-mid");
    landingBar.classList.add("is-open");
    if (state.landingsCustomH && mode === "mid") {
      app.style.setProperty("--landing-h", `${state.landingsCustomH}px`);
    } else {
      app.style.removeProperty("--landing-h");
    }
  }

  const open = mode !== "collapsed";
  $("#btn-landings-toggle")?.setAttribute("aria-expanded", open ? "true" : "false");
  // Highlight Landings chip on the slide when panel is open
  $("#btn-landings")?.classList.toggle("active", open);
  $("#btn-landings")?.classList.toggle("landings-active", open);
  $("#btn-landings-focus")?.classList.toggle("active", state.landingsFilter === "focus");
  $("#btn-landings-all")?.classList.toggle("active", state.landingsFilter === "all");
}

function setLandingsMode(mode) {
  state.landingsMode = mode;
  if (mode === "collapsed") state.landingsCustomH = null;
  applyLandingsMode();
  saveLandingsPrefs();
}

function toggleLandingsPanel() {
  if (state.landingsMode === "collapsed") setLandingsMode("mid");
  else setLandingsMode("collapsed");
}

function cycleLandingsSize() {
  if (state.landingsMode === "collapsed") setLandingsMode("mid");
  else if (state.landingsMode === "mid") setLandingsMode("tall");
  else setLandingsMode("mid");
}

function bindLandingsUi() {
  loadLandingsPrefs();
  // Force manual-open only (ignore any old autoOpen prefs)
  state.landingsAutoOpen = false;
  applyLandingsMode();

  const openCloseLandings = () => {
    toggleLandingsPanel();
    setStatus(
      state.landingsMode === "collapsed"
        ? "Landings panel collapsed"
        : "Landings panel open — use Landings / L to close"
    );
  };
  // Landings control lives on the slide (replaces Collapse); also bottom title toggle + L key
  $("#btn-landings")?.addEventListener("click", openCloseLandings);
  $("#btn-landings-toggle")?.addEventListener("click", openCloseLandings);
  // Wire list control lives on the landings slide
  $("#btn-landings-wirelist")?.addEventListener("click", () => {
    setWireListDrawerOpen(true);
    setStatus("Wire list panel open");
  });
  $("#btn-landings-focus")?.addEventListener("click", () => {
    state.landingsFilter = "focus";
    saveLandingsPrefs();
    applyLandingsMode();
    renderLandings();
  });
  $("#btn-landings-all")?.addEventListener("click", () => {
    state.landingsFilter = "all";
    saveLandingsPrefs();
    applyLandingsMode();
    renderLandings();
  });

  // Drag resize only when already open (does not pop open on selection)
  const handle = $("#landing-resize-handle");
  if (handle) {
    let dragging = false;
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (state.landingsMode === "collapsed") return;
      dragging = true;
      landingBar?.classList.add("is-resizing");
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    handle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const app = $("#app");
      if (!app) return;
      const rect = app.getBoundingClientRect();
      const fromBottom = rect.bottom - e.clientY;
      const h = Math.min(Math.max(fromBottom, 120), Math.floor(window.innerHeight * 0.85));
      state.landingsCustomH = h;
      state.landingsMode = h > window.innerHeight * 0.55 ? "tall" : "mid";
      applyLandingsMode();
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      landingBar?.classList.remove("is-resizing");
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      saveLandingsPrefs();
    };
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  }
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

  // occupancy first (needed for stats + cards)
  const occupancy = new Map();
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

  let wired = 0;
  let open = 0;
  for (const node of nodes) {
    for (const t of node.terminals || []) {
      if ((occupancy.get(`${node.id}:${t.id}`) || []).length) wired++;
      else open++;
    }
  }
  if (landingStats) {
    landingStats.textContent = `${wired} wired · ${open} open`;
    landingStats.classList.toggle("has-open", open > 0);
  }

  let show = nodes;
  if (state.landingsFilter === "focus" && focusIds.size) {
    show = nodes.filter((n) => focusIds.has(n.id));
    landingContext.textContent = `Focused: ${show.map((n) => n.tag).join(" · ")}`;
  } else if (state.landingsFilter === "focus" && !focusIds.size) {
    show = nodes;
    landingContext.textContent = nodes.length
      ? `All ${nodes.length} devices (select one to focus) · filter: Selection`
      : "No devices yet";
  } else {
    show = nodes;
    landingContext.textContent = nodes.length
      ? `All devices (${nodes.length})`
      : "No devices yet";
  }

  if (!show.length) {
    landingMap.innerHTML = `<div class="landing-placeholder">Place devices and junction boxes, then draw cables between terminals. Press <kbd>L</kbd> or use <strong>Landings</strong> in the toolbar.</div>`;
    return;
  }

  landingMap.innerHTML = show
    .map((node) => {
      let nodeWired = 0;
      let nodeOpen = 0;
      const terms = (node.terminals || [])
        .map((t) => {
          const occ = occupancy.get(`${node.id}:${t.id}`) || [];
          const empty = !occ.length;
          if (empty) nodeOpen++;
          else nodeWired++;
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

      const focused = focusIds.has(node.id);
      return `
        <div class="landing-card${focused ? " is-focused" : ""}" data-node-id="${node.id}">
          <header>
            <span class="lc-title">${escapeHtml(node.tag)} — ${escapeHtml(node.name)}</span>
            <span class="badge ${node.category}">${node.category}</span>
          </header>
          <div class="lc-tag">${escapeHtml(node.location || node.type)}</div>
          <div class="lc-summary">
            <span class="wired">${nodeWired} wired</span>
            <span class="open-count">${nodeOpen} open</span>
          </div>
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
      // scroll card into view after re-render (panel stays as user left it)
      requestAnimationFrame(() => {
        landingMap
          ?.querySelector(`.landing-card[data-node-id="${card.dataset.nodeId}"]`)
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
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
          side: termHit.side,
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
      side: termHit.side,
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

  // cable path / route-handle hit — click-hold drag to adjust layout
  const cableTarget =
    e.target.closest?.("[data-cable-id]") ||
    (e.target.dataset?.cableId ? e.target : null);
  if (cableTarget?.dataset?.cableId && state.tool === "select") {
    const cableId = cableTarget.dataset.cableId;
    state.selection = { type: "cable", id: cableId };
    state.cableDragging = {
      cableId,
      moved: false,
      fromHandle: e.target.dataset?.routeHandle === "1",
    };
    // Ensure route exists so drag has a control point
    const cable = state.project.cables.find((c) => c.id === cableId);
    if (cable) {
      const ep = cableEndpoints(cable, state.project.nodes);
      if (ep) {
        const h = getCableRouteHandle(cable, ep);
        if (!cable.route) cable.route = {};
        if (typeof cable.route.midX !== "number") cable.route.midX = h.midX;
        if (typeof cable.route.midY !== "number") cable.route.midY = h.midY;
      }
    }
    canvasContainer.classList.add("cable-dragging");
    render();
    setStatus("Drag cable to adjust route — release to place");
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

  if (state.cableDragging) {
    const cable = state.project.cables.find(
      (c) => c.id === state.cableDragging.cableId
    );
    if (cable) {
      if (!state.cableDragging.moved) {
        pushHistory();
        state.cableDragging.moved = true;
      }
      if (!cable.route) cable.route = {};
      // Free-form elbow: midX / midY follow cursor (orthogonal segments rebuild)
      cable.route.midX = Math.round(world.x);
      cable.route.midY = Math.round(world.y);
      renderDiagram(layers, state.project, state.selection, state.hoverTerm);
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
  if (state.cableDragging) {
    canvasContainer.classList.remove("cable-dragging");
    if (state.cableDragging.moved) {
      state.project.updatedAt = new Date().toISOString();
      persistDebounced();
      const c = state.project.cables.find((x) => x.id === state.cableDragging.cableId);
      setStatus(
        c
          ? `Cable ${c.cableId} route updated`
          : "Cable route updated"
      );
    }
    state.cableDragging = null;
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
      saveCurrentProjectNow();
      const project = {
        ...createEmptyProject(data.name || "Imported project"),
        ...data,
        id: uid("proj"), // always new entry in library
        nodes: data.nodes || [],
        cables: data.cables || [],
        view: data.view || { x: 0, y: 0, scale: 1 },
        updatedAt: new Date().toISOString(),
      };
      if (!project.createdAt) project.createdAt = project.updatedAt;
      state.library.projects[project.id] = deepClone(project);
      state.library.activeId = project.id;
      state.project = project;
      state.selection = null;
      state.history = [];
      state.future = [];
      state.dirty = false;
      persistLibraryNow();
      refreshProjectSwitcher();
      render();
      setStatus(`Imported as new project: ${project.name}`);
    } catch (err) {
      setStatus("Import failed");
      alert("Could not import file: " + err.message);
    }
  };
  reader.readAsText(file);
}

function newProject() {
  const name = prompt("New project name:", nextDefaultProjectName());
  if (name === null) return;
  saveCurrentProjectNow();
  const project = createEmptyProject(name.trim() || nextDefaultProjectName());
  // Blank canvas by default; optional demo via confirm
  const withDemo = confirm(
    "Load the demo packer-line starter on this project?\n\nOK = demo starter\nCancel = blank canvas"
  );
  state.project = project;
  state.selection = null;
  state.history = [];
  state.future = [];
  state.dirty = false;
  if (withDemo) seedDemo();
  state.library.projects[project.id] = deepClone(state.project);
  state.library.activeId = project.id;
  persistLibraryNow();
  refreshProjectSwitcher();
  render();
  requestAnimationFrame(() => {
    setView(fitView(svg, state.project));
    render();
  });
  setStatus(`New project: ${state.project.name}`);
}

function duplicateProject() {
  saveCurrentProjectNow();
  const src = deepClone(state.project);
  const copy = {
    ...src,
    id: uid("proj"),
    name: `${src.name || "Project"} (copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.library.projects[copy.id] = copy;
  state.library.activeId = copy.id;
  state.project = deepClone(copy);
  state.selection = null;
  state.history = [];
  state.future = [];
  state.dirty = false;
  persistLibraryNow();
  refreshProjectSwitcher();
  render();
  setStatus(`Duplicated project: ${copy.name}`);
}

function deleteCurrentProject() {
  const ids = Object.keys(state.library.projects);
  if (ids.length <= 1) {
    alert("Cannot delete the only project. Create another project first, or use New.");
    return;
  }
  const name = state.project.name || "this project";
  if (!confirm(`Delete project "${name}"?\n\nThis cannot be undone (export JSON first if you need a backup).`)) {
    return;
  }
  const delId = state.project.id;
  delete state.library.projects[delId];
  const nextId =
    Object.keys(state.library.projects).sort((a, b) => {
      const ua = state.library.projects[a].updatedAt || "";
      const ub = state.library.projects[b].updatedAt || "";
      return ub.localeCompare(ua);
    })[0];
  state.library.activeId = nextId;
  state.project = deepClone(state.library.projects[nextId]);
  ensureProjectId(state.project);
  state.selection = null;
  state.history = [];
  state.future = [];
  state.dirty = false;
  persistLibraryNow();
  refreshProjectSwitcher();
  render();
  setStatus(`Deleted project. Now editing: ${state.project.name}`);
}

function nextDefaultProjectName() {
  const n = Object.keys(state.library.projects || {}).length + 1;
  return `Project ${n}`;
}

// ── Save (local + optional GitHub) ──
function updateGitHubBadge(stateName) {
  const badge = $("#github-sync-badge");
  if (!badge) return;
  const cfg = loadGitHubSettings();
  badge.classList.remove("on", "off", "busy", "err");
  if (stateName === "busy") {
    badge.classList.add("busy");
    badge.textContent = "GH · syncing…";
    return;
  }
  if (stateName === "err") {
    badge.classList.add("err");
    badge.textContent = "GH · error";
    return;
  }
  if (isGitHubConfigured(cfg)) {
    badge.classList.add("on");
    badge.textContent = `GH · ${cfg.owner}/${cfg.repo}`;
    badge.title = `Connected: ${cfg.owner}/${cfg.repo}@${cfg.branch}. Save=push, Pull=download. Auto-push: ${cfg.autoSync ? "on" : "off"}, Auto-pull: ${cfg.autoPull !== false ? "on" : "off"}`;
  } else if (canPullFromGitHub(cfg)) {
    badge.classList.add("on");
    badge.textContent = "GH · pull-only";
    badge.title = "Owner/repo set — can Pull public data. Add a token to Save/push.";
  } else {
    badge.classList.add("off");
    badge.textContent = "GH · off";
    badge.title = "Not connected. Click GitHub to set repo + token.";
  }
}

function openGitHubSettings() {
  const s = loadGitHubSettings();
  $("#gh-owner").value = s.owner || "";
  $("#gh-repo").value = s.repo || "";
  $("#gh-branch").value = s.branch || "main";
  $("#gh-token").value = s.token || "";
  $("#gh-autosync").value = s.autoSync ? "1" : "0";
  $("#gh-autopull").value = s.autoPull !== false ? "1" : "0";
  $("#gh-path-projects").value = s.pathProjects || "data/projects-library.json";
  $("#gh-path-catalog").value = s.pathCatalog || "data/device-catalog.json";
  $("#gh-test-result").textContent = isGitHubConfigured(s)
    ? "Token on file — Test, Pull now, or Save settings."
    : "Add owner/repo (and token for push). Public repos can Pull without a token.";
  $("#github-modal")?.classList.remove("hidden");
}

function readGitHubForm() {
  return {
    owner: ($("#gh-owner")?.value || "").trim(),
    repo: ($("#gh-repo")?.value || "").trim(),
    branch: ($("#gh-branch")?.value || "main").trim() || "main",
    token: ($("#gh-token")?.value || "").trim(),
    autoSync: $("#gh-autosync")?.value === "1",
    autoPull: $("#gh-autopull")?.value === "1",
    pathProjects: ($("#gh-path-projects")?.value || "data/projects-library.json").trim(),
    pathCatalog: ($("#gh-path-catalog")?.value || "data/device-catalog.json").trim(),
    pathActive: "data/active-project.json",
  };
}

function applyRemoteLibrary(remoteLib, { preferRemoteActive = true } = {}) {
  if (!remoteLib?.projects || typeof remoteLib.projects !== "object") {
    return { projectCount: Object.keys(state.library.projects || {}).length, skipped: true };
  }
  const remoteCount = Object.keys(remoteLib.projects).length;
  const localCount = Object.keys(state.library.projects || {}).length;

  // Never apply an empty remote library over local work
  if (remoteCount === 0 && localCount > 0) {
    console.warn("Skipping empty remote project library");
    return { projectCount: localCount, skipped: true };
  }

  const merged = mergeProjectLibraries(
    {
      activeId: state.library.activeId,
      projects: state.library.projects,
      savedAt: state.library.savedAt,
    },
    remoteLib
  );

  // Safety: never end up with zero projects if we had local data
  if (
    Object.keys(merged.projects || {}).length === 0 &&
    localCount > 0
  ) {
    console.warn("Merge produced empty library — keeping local");
    return { projectCount: localCount, skipped: true };
  }

  state.library.projects = merged.projects;
  state.library.activeId = preferRemoteActive
    ? merged.activeId
    : state.library.activeId && merged.projects[state.library.activeId]
      ? state.library.activeId
      : merged.activeId;
  state.library.savedAt = merged.savedAt;

  // Normalize project ids
  for (const [key, p] of Object.entries(state.library.projects)) {
    if (!p.id) p.id = key;
    ensureProjectId(p);
  }

  const activeId = state.library.activeId;
  if (activeId && state.library.projects[activeId]) {
    state.project = deepClone(state.library.projects[activeId]);
  } else {
    const first = Object.keys(state.library.projects)[0];
    if (first) {
      state.library.activeId = first;
      state.project = deepClone(state.library.projects[first]);
    }
  }
  ensureProjectId(state.project);
  state.selection = null;
  state.history = [];
  state.future = [];
  state.dirty = false;
  persistLibraryNow();
  refreshProjectSwitcher();
  return { projectCount: Object.keys(state.library.projects).length, skipped: false };
}

/**
 * Download projects + catalog from GitHub and merge into this browser.
 * Never wipes local projects/catalog if remote is empty or invalid.
 */
async function loadFromGitHub({ fromUser = false, quiet = false } = {}) {
  const cfg = loadGitHubSettings();
  if (!canPullFromGitHub(cfg)) {
    if (fromUser) {
      alert("Set Owner and Repository in GitHub settings first.");
      openGitHubSettings();
    }
    return { ok: false };
  }

  // Snapshot local state for recovery
  const localSnap = {
    library: deepClone(state.library),
    project: deepClone(state.project),
  };
  const localProjectCount = Object.keys(state.library.projects || {}).length;

  updateGitHubBadge("busy");
  if (!quiet) setStatus("Pulling projects from GitHub…");

  try {
    const remote = await pullFromGitHub(cfg);
    let projectCount = localProjectCount;

    if (remote.projects?.projects && typeof remote.projects.projects === "object") {
      const r = applyRemoteLibrary(remote.projects, { preferRemoteActive: true });
      projectCount = r.projectCount;
    } else if (remote.projects && remote.projects.type === "raiv-wire-projects-library") {
      const r = applyRemoteLibrary(remote.projects, { preferRemoteActive: true });
      projectCount = r.projectCount;
    } else if (remote.active?.project) {
      // Fallback: only active-project.json available
      const p = remote.active.project;
      ensureProjectId(p);
      if (!state.library.projects) state.library.projects = {};
      const existing = state.library.projects[p.id];
      if (
        !existing ||
        (p.updatedAt || "") >= (existing.updatedAt || "")
      ) {
        state.library.projects[p.id] = deepClone(p);
        state.library.activeId = p.id;
        state.project = deepClone(p);
        persistLibraryNow();
        refreshProjectSwitcher();
      }
      projectCount = Object.keys(state.library.projects).length;
    }

    // Catalog: merge then force-restore built-in components
    if (remote.catalog) {
      try {
        importCatalogJson(JSON.stringify(remote.catalog), "merge");
      } catch (err) {
        console.warn("Catalog pull merge failed", err);
      }
    }
    try {
      ensureSeedItems(true);
      loadCatalog();
      renderCatalogPalette();
    } catch (err) {
      console.warn("Seed restore failed", err);
      try {
        restoreSeedCatalog();
        renderCatalogPalette();
      } catch {
        /* ignore */
      }
    }

    // Final safety: if we wiped projects, restore snapshot
    if (
      Object.keys(state.library.projects || {}).length === 0 &&
      localProjectCount > 0
    ) {
      state.library = localSnap.library;
      state.project = localSnap.project;
      persistLibraryNow();
      refreshProjectSwitcher();
      projectCount = localProjectCount;
      setStatus("Pull skipped empty remote — kept your local projects");
    }

    updateGitHubBadge();
    render();
    requestAnimationFrame(() => {
      applyViewport(viewportEl, state.project.view || { x: 0, y: 0, scale: 1 });
      render();
    });

    const catCount = (getCatalogItems() || []).length;
    const msg = `Pulled from GitHub: ${projectCount} project${projectCount === 1 ? "" : "s"}, ${catCount} catalog items → ${cfg.owner}/${cfg.repo}`;
    setStatus(msg);
    return { ok: true, projectCount, catCount, remote };
  } catch (err) {
    // Restore snapshot on hard failure
    if (localProjectCount > 0) {
      state.library = localSnap.library;
      state.project = localSnap.project;
      persistLibraryNow();
    }
    updateGitHubBadge("err");
    setStatus("GitHub pull failed: " + err.message);
    if (fromUser) {
      alert(
        "Could not pull from GitHub:\n\n" +
          err.message +
          "\n\nYour local data was kept. Tip: Save from a machine that has your work, or use Recover components."
      );
    }
    return { ok: false, error: err };
  }
}

/** Emergency: restore built-in device catalog seeds */
function recoverComponentsCatalog() {
  restoreSeedCatalog();
  renderCatalogPalette();
  setStatus(
    `Device catalog restored: ${getCatalogItems().length} components (built-in seeds + your custom items)`
  );
  alert(
    `Components catalog restored.\n\n${getCatalogItems().length} devices available in Device catalog.\n\nClick Save to push the full catalog back to GitHub.`
  );
}

/**
 * Full factory restore from data/factory-recovery.json (repo snapshot)
 * + built-in seeds. Restores Demo Build project and complete catalog.
 */
async function factoryRestoreFromRepo() {
  // Immediate feedback so a hang never looks like "no response"
  try {
    setStatus("Factory restore: starting…");
  } catch {
    /* ignore */
  }

  let proceed = true;
  try {
    proceed = window.confirm(
      "FACTORY RESTORE\n\nThis will reload known-good data from the app package:\n" +
        "• Full device catalog (CLICK, Staubli, Fuji, sensors, …)\n" +
        "• Demo Build project from chat/repo history\n\n" +
        "Existing projects with different IDs are kept.\n" +
        "Continue?"
    );
  } catch {
    proceed = true; // if confirm blocked, still restore
  }
  if (!proceed) {
    setStatus("Factory restore cancelled");
    return { ok: false, cancelled: true };
  }

  try {
    updateGitHubBadge("busy");
  } catch {
    /* ignore */
  }
  setStatus("Factory restore: loading recovery bundle…");

  try {
    // 1) Always restore catalog seeds (works even if fetch fails)
    restoreSeedCatalog();
    try {
      renderCatalogPalette();
    } catch {
      /* palette may not be ready */
    }

    // 2) Load recovery JSON — try several URLs (Pages path, relative, raw GitHub)
    const stamp = Date.now();
    const urls = [
      `data/factory-recovery.json?t=${stamp}`,
      `./data/factory-recovery.json?t=${stamp}`,
      `https://cotycoots-tech.github.io/raiv-wire/data/factory-recovery.json?t=${stamp}`,
      `https://raw.githubusercontent.com/cotycoots-tech/raiv-wire/main/data/factory-recovery.json?t=${stamp}`,
    ];
    let bundle = null;
    let lastErr = null;
    for (const url of urls) {
      try {
        setStatus(`Factory restore: fetching ${url.split("?")[0]}…`);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          lastErr = new Error(`${url} → HTTP ${res.status}`);
          continue;
        }
        bundle = await res.json();
        setStatus(`Factory restore: loaded bundle from ${url.split("?")[0]}`);
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!bundle) {
      throw lastErr || new Error("Could not load data/factory-recovery.json");
    }

    if (bundle.catalog?.items) {
      try {
        importCatalogJson(JSON.stringify(bundle.catalog), "merge");
      } catch (e) {
        console.warn(e);
      }
      ensureSeedItems(true);
    }

    if (bundle.projectsLibrary?.projects) {
      applyRemoteLibrary(bundle.projectsLibrary, { preferRemoteActive: true });
    } else if (bundle.activeProject?.project) {
      const p = bundle.activeProject.project;
      ensureProjectId(p);
      state.library.projects = state.library.projects || {};
      state.library.projects[p.id] = deepClone(p);
      state.library.activeId = p.id;
      state.project = deepClone(p);
      persistLibraryNow();
      refreshProjectSwitcher();
    }

    // 3) Final seed pass (skip network pull here — keep restore fast & reliable)
    ensureSeedItems(true);
    try {
      renderCatalogPalette();
    } catch {
      /* ignore */
    }
    refreshProjectSwitcher();
    render();
    requestAnimationFrame(() => {
      try {
        setView(fitView(svg, state.project));
      } catch {
        /* ignore */
      }
      render();
    });

    const n = Object.keys(state.library.projects || {}).length;
    const c = (getCatalogItems() || []).length;
    try {
      updateGitHubBadge();
    } catch {
      /* ignore */
    }
    setStatus(`Factory restore complete: ${n} project(s), ${c} catalog devices — click Save to push to GitHub`);
    try {
      window.alert(
        `Restore complete.\n\nProjects: ${n}\nCatalog devices: ${c}\nActive: ${state.project?.name || "—"}\n\n` +
          `Click Save to push this recovered state to GitHub so all PCs can Pull it.`
      );
    } catch {
      /* ignore */
    }
    return { ok: true, projectCount: n, catalogCount: c };
  } catch (err) {
    console.error("Factory restore failed", err);
    try {
      updateGitHubBadge("err");
    } catch {
      /* ignore */
    }
    setStatus("Factory restore failed: " + (err?.message || err));
    // still restore seeds at minimum
    try {
      restoreSeedCatalog();
      renderCatalogPalette();
    } catch {
      /* ignore */
    }
    try {
      window.alert(
        "Factory restore failed:\n\n" +
          (err?.message || err) +
          "\n\nBuilt-in components were still restored if possible. Check the status bar for details."
      );
    } catch {
      /* ignore */
    }
    return { ok: false, error: err };
  }
}

// Expose for toolbar onclick / console debugging
window.factoryRestoreFromRepo = factoryRestoreFromRepo;
window.recoverComponentsCatalog = recoverComponentsCatalog;

function bindGitHubSettingsModal() {
  $("#gh-cancel")?.addEventListener("click", () => {
    $("#github-modal")?.classList.add("hidden");
  });
  $("#gh-clear-token")?.addEventListener("click", () => {
    $("#gh-token").value = "";
    const s = readGitHubForm();
    s.token = "";
    saveGitHubSettings(s);
    updateGitHubBadge();
    $("#gh-test-result").textContent = "Token cleared from this browser.";
  });
  $("#gh-save-settings")?.addEventListener("click", async () => {
    const s = readGitHubForm();
    saveGitHubSettings(s);
    updateGitHubBadge();
    $("#github-modal")?.classList.add("hidden");
    setStatus(
      isGitHubConfigured(s)
        ? `GitHub connected: ${s.owner}/${s.repo} (push ${s.autoSync ? "on" : "off"}, pull ${s.autoPull ? "on" : "off"})`
        : canPullFromGitHub(s)
          ? `GitHub repo set (${s.owner}/${s.repo}) — Pull works; add token to Save/push`
          : "GitHub settings saved"
    );
    if (s.autoPull && canPullFromGitHub(s)) {
      await loadFromGitHub({ fromUser: false, quiet: true });
    }
  });
  $("#gh-test")?.addEventListener("click", async () => {
    const s = readGitHubForm();
    const el = $("#gh-test-result");
    el.textContent = "Testing…";
    try {
      if (!s.token) {
        // Try public pull as a connectivity check
        saveGitHubSettings({ ...loadGitHubSettings(), ...s });
        const remote = await pullFromGitHub(s);
        const n = Object.keys(remote.projects?.projects || {}).length;
        el.textContent = `Public pull OK — found ${n} project(s) in data/ (add a token to push/Save).`;
        setStatus("GitHub public pull OK");
        return;
      }
      const info = await testGitHubConnection(s);
      el.textContent = `OK — ${info.fullName} (${info.private ? "private" : "public"}), default branch ${info.defaultBranch}`;
      setStatus("GitHub connection OK");
    } catch (err) {
      el.textContent = `Failed: ${err.message}`;
      setStatus("GitHub test failed");
    }
  });
  $("#gh-pull-now")?.addEventListener("click", async () => {
    const s = readGitHubForm();
    saveGitHubSettings(s);
    $("#github-modal")?.classList.add("hidden");
    await loadFromGitHub({ fromUser: true });
  });
}

/**
 * Save locally always; push to GitHub when configured + autoSync (or forceGithub).
 */
async function saveAll({ fromUser = false, forceGithub = false } = {}) {
  const btn = $("#btn-save");
  btn?.classList.add("saving");
  setStatus("Saving locally…", "busy");

  try {
    const localResult = persistLibraryNow();
    state.dirty = false;

    if (!localResult?.ok) {
      const errMsg = localResult?.error || "localStorage write failed";
      setStatus("Local save failed: " + errMsg, "err");
      if (fromUser) {
        alert(
          "Could not save in this browser:\n\n" +
            errMsg +
            "\n\nStorage may be full or blocked. Try Export JSON as a backup."
        );
      }
      updateGitHubBadge();
      return { local: false, github: false, error: errMsg };
    }

    const nProj = localResult.projectCount || 0;
    const catN = (getCatalogItems() || []).length;
    const when = new Date().toLocaleTimeString();
    const localMsg = `Saved locally at ${when} · ${nProj} project(s) · ${catN} catalog · “${localResult.name || "Untitled"}”`;

    // Always show local success first (even if GitHub push follows)
    setStatus(localMsg, "ok");

    const cfg = loadGitHubSettings();
    const shouldSync = isGitHubConfigured(cfg) && (cfg.autoSync || forceGithub);

    if (!shouldSync) {
      const extra = isGitHubConfigured(cfg)
        ? " · GitHub auto-push is OFF (enable in GitHub settings)"
        : cfg.owner && cfg.repo
          ? " · GH pull-only — add token to push"
          : " · GitHub not connected";
      setStatus(localMsg + extra, "ok");
      updateGitHubBadge();
      return { local: true, github: false, localResult };
    }

    updateGitHubBadge("busy");
    setStatus(localMsg + " · pushing to GitHub…", "busy");

    const result = await syncToGitHub(cfg, {
      library: {
        activeId: state.library.activeId,
        projects: state.library.projects,
      },
      catalogJson: exportCatalogJson(),
      activeProject: deepClone(state.project),
    });

    updateGitHubBadge();
    const n = result.files?.length || 0;
    setStatus(
      `${localMsg} · GitHub OK (${n} file${n === 1 ? "" : "s"} → ${cfg.owner}/${cfg.repo}@${cfg.branch})`,
      "ok"
    );
    return { local: true, github: true, result, localResult };
  } catch (err) {
    updateGitHubBadge("err");
    // Local already succeeded if we got past persist
    setStatus("Saved locally · GitHub failed: " + err.message, "warn");
    if (fromUser) {
      alert(
        "Saved in this browser, but GitHub push failed:\n\n" +
          err.message +
          "\n\nCheck token permissions (Contents: Read and write) and repo name."
      );
    }
    return { local: true, github: false, error: err };
  } finally {
    btn?.classList.remove("saving");
  }
}

// ── Multi-project library persistence ──
let persistTimer;

function ensureProjectId(project) {
  if (!project.id) project.id = uid("proj");
  return project.id;
}

function saveCurrentProjectNow() {
  try {
    if (projectNameInput) {
      state.project.name = projectNameInput.value || state.project.name;
    }
    state.project.updatedAt = new Date().toISOString();
    ensureProjectId(state.project);
    if (!state.library.projects) state.library.projects = {};
    state.library.projects[state.project.id] = deepClone(state.project);
    state.library.activeId = state.project.id;
    // also keep legacy key in sync for older tools
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.project));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

function persistLibraryNow() {
  try {
    const step = saveCurrentProjectNow();
    if (step && step.ok === false) return step;
    const payload = {
      version: 1,
      activeId: state.library.activeId,
      projects: state.library.projects,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(payload));
    // Also persist catalog snapshot key so recovery is easier
    try {
      const cat = exportCatalogJson();
      localStorage.setItem("raiv-wire-device-catalog-v1", cat);
    } catch {
      /* catalog optional */
    }
    return {
      ok: true,
      projectCount: Object.keys(state.library.projects || {}).length,
      name: state.project?.name || "",
      activeId: state.library.activeId,
      savedAt: payload.savedAt,
    };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

function persistDebounced() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistLibraryNow();
    state.dirty = false;
  }, 400);
}

function listLibraryProjects() {
  return Object.values(state.library.projects || {}).sort((a, b) => {
    const ua = a.updatedAt || a.createdAt || "";
    const ub = b.updatedAt || b.createdAt || "";
    return ub.localeCompare(ua);
  });
}

function refreshProjectSwitcher() {
  const sel = $("#project-switcher");
  if (!sel) return;
  const items = listLibraryProjects();
  const active = state.project?.id || state.library.activeId;
  sel.innerHTML = items
    .map((p) => {
      const label = escapeHtml(p.name || "Untitled");
      const count = (p.nodes || []).length;
      const text = `${label} (${count} devices)`;
      return `<option value="${escapeAttr(p.id)}" ${p.id === active ? "selected" : ""}>${text}</option>`;
    })
    .join("");
  if (!items.length) {
    sel.innerHTML = `<option value="">No projects</option>`;
  }
}

function switchToProject(projectId) {
  if (!projectId || projectId === state.project.id) return;
  const target = state.library.projects[projectId];
  if (!target) {
    setStatus("Project not found");
    refreshProjectSwitcher();
    return;
  }
  saveCurrentProjectNow();
  persistLibraryNow();
  state.project = deepClone(target);
  ensureProjectId(state.project);
  state.library.activeId = state.project.id;
  state.selection = null;
  state.cableFrom = null;
  state.history = [];
  state.future = [];
  state.dirty = false;
  persistLibraryNow();
  refreshProjectSwitcher();
  render();
  requestAnimationFrame(() => {
    applyViewport(viewportEl, state.project.view || { x: 0, y: 0, scale: 1 });
    render();
  });
  setStatus(`Switched to: ${state.project.name}`);
}

function loadPersisted() {
  try {
    // Prefer multi-project library
    const libRaw = localStorage.getItem(LIBRARY_KEY);
    if (libRaw) {
      const lib = JSON.parse(libRaw);
      if (lib.projects && typeof lib.projects === "object") {
        state.library.projects = lib.projects;
        // normalize ids
        for (const [key, p] of Object.entries(state.library.projects)) {
          if (!p.id) p.id = key;
          ensureProjectId(p);
          if (p.id !== key) {
            state.library.projects[p.id] = p;
            delete state.library.projects[key];
          }
        }
        let activeId = lib.activeId;
        if (!activeId || !state.library.projects[activeId]) {
          activeId = Object.keys(state.library.projects)[0];
        }
        if (activeId && state.library.projects[activeId]) {
          state.library.activeId = activeId;
          state.project = deepClone(state.library.projects[activeId]);
          ensureProjectId(state.project);
          return true;
        }
      }
    }

    // Migrate legacy single project
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data.nodes) return false;
    const project = { ...createEmptyProject(), ...data };
    ensureProjectId(project);
    state.library = {
      activeId: project.id,
      projects: { [project.id]: deepClone(project) },
    };
    state.project = project;
    persistLibraryNow();
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
  if (mod && (e.key === "s" || e.key === "S")) {
    e.preventDefault();
    saveAll({ fromUser: true });
    return;
  }
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
  if (e.key === "l" || e.key === "L") {
    if (isTyping()) return;
    e.preventDefault();
    toggleLandingsPanel();
    return;
  }
  if (e.key === "w" || e.key === "W") {
    if (isTyping()) return;
    e.preventDefault();
    toggleWireListDrawer();
    return;
  }
  if (e.key === "Escape") {
    if (state.wireListDrawerOpen) {
      setWireListDrawerOpen(false);
      return;
    }
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
  $("#btn-duplicate-project")?.addEventListener("click", duplicateProject);
  $("#btn-delete-project")?.addEventListener("click", deleteCurrentProject);
  $("#btn-export").addEventListener("click", exportJSON);
  $("#btn-export-csv").addEventListener("click", exportCSV);
  $("#btn-save")?.addEventListener("click", (e) => {
    e.preventDefault();
    setStatus("Save clicked — writing local data…", "busy");
    saveAll({ fromUser: true }).catch((err) => {
      setStatus("Save error: " + (err?.message || err), "err");
      alert("Save error:\n" + (err?.message || err));
    });
  });
  $("#btn-github-settings")?.addEventListener("click", openGitHubSettings);
  $("#btn-github-pull")?.addEventListener("click", () => loadFromGitHub({ fromUser: true }));
  $("#btn-recover-catalog")?.addEventListener("click", () => {
    if (
      confirm(
        "Restore all built-in device catalog components (CLICK PLC, Staubli, Fuji, sensors, etc.)?\n\nYour custom catalog items are kept. Then click Save to update GitHub."
      )
    ) {
      recoverComponentsCatalog();
    }
  });
  const factoryBtn = $("#btn-factory-restore");
  if (factoryBtn) {
    factoryBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setStatus("Factory restore clicked…");
      factoryRestoreFromRepo().catch((err) => {
        console.error(err);
        setStatus("Factory restore error: " + (err?.message || err));
        alert("Factory restore error:\n" + (err?.message || err));
      });
    });
  }
  $("#btn-print").addEventListener("click", () => printToPdf());
  window.addEventListener("beforeprint", preparePrintLayout);
  window.addEventListener("afterprint", restorePrintLayout);
  bindGitHubSettingsModal();
  bindLandingsUi();
  bindWireListUi();
  updateGitHubBadge();
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
    refreshProjectSwitcher();
  });
  projectNameInput.addEventListener("input", () => {
    // live-update dropdown label without full persist
    const sel = $("#project-switcher");
    if (!sel || !state.project?.id) return;
    const opt = [...sel.options].find((o) => o.value === state.project.id);
    if (opt) {
      const count = (state.project.nodes || []).length;
      opt.textContent = `${projectNameInput.value || "Untitled"} (${count} devices)`;
    }
  });
  $("#project-switcher")?.addEventListener("change", (e) => {
    switchToProject(e.target.value);
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
async function init() {
  buildPalette();
  bindUI();
  const loaded = loadPersisted();
  if (!loaded) {
    // First run: create demo project in library
    state.project = createEmptyProject("Demo Packer Line");
    seedDemo();
    ensureProjectId(state.project);
    state.library = {
      activeId: state.project.id,
      projects: { [state.project.id]: deepClone(state.project) },
    };
    persistLibraryNow();
  } else {
    ensureProjectId(state.project);
    if (!state.library.projects) state.library.projects = {};
    if (!state.library.projects[state.project.id] && state.project.nodes?.length) {
      state.library.projects[state.project.id] = deepClone(state.project);
      state.library.activeId = state.project.id;
      persistLibraryNow();
    }
  }

  // Always ensure built-in components exist (never leave empty catalog)
  try {
    loadCatalog();
    ensureSeedItems(true);
    renderCatalogPalette();
  } catch (err) {
    console.warn(err);
    try {
      restoreSeedCatalog();
      renderCatalogPalette();
    } catch {
      /* ignore */
    }
  }

  refreshProjectSwitcher();
  setTool("select");
  render();

  // Pull remote — merge only, never wipe local
  const cfg = loadGitHubSettings();
  if (cfg.autoPull !== false && canPullFromGitHub(cfg)) {
    await loadFromGitHub({ fromUser: false, quiet: true });
  }

  // If still no projects after pull, seed demo so UI is never empty
  if (!Object.keys(state.library.projects || {}).length) {
    state.project = createEmptyProject("Demo Packer Line");
    seedDemo();
    ensureProjectId(state.project);
    state.library = {
      activeId: state.project.id,
      projects: { [state.project.id]: deepClone(state.project) },
    };
    persistLibraryNow();
    refreshProjectSwitcher();
  }

  // fit after layout
  requestAnimationFrame(() => {
    applyViewport(
      viewportEl,
      state.project.view || { x: 0, y: 0, scale: 1 }
    );
    if (!loaded) {
      setView(fitView(svg, state.project));
    }
    render();
    const n = Object.keys(state.library.projects).length;
    const c = (getCatalogItems() || []).length;
    setStatus(
      `Ready: ${state.project.name} · ${n} project(s) · ${c} catalog devices. Save=push · Pull=download · Recover components if catalog empty.`
    );
  });

  // Save active project when leaving the page
  window.addEventListener("beforeunload", () => {
    try {
      persistLibraryNow();
    } catch {
      /* ignore */
    }
  });
}

init();
