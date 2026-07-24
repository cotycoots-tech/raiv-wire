/**
 * RAIV Wire — reusable device / inventory catalog
 * Saved items keep terminals, mfr, P/N so they can be placed without reconfiguring.
 */

import {
  uid,
  nextTag,
  findCatalogEntry,
  deepClone,
} from "./data.js";

const STORAGE_KEY = "raiv-wire-device-catalog-v1";

/** Inventory family labels for palette grouping */
export const INVENTORY_GROUPS = [
  { id: "plc", label: "PLC / controls" },
  { id: "drives", label: "Drives / motors" },
  { id: "sensors", label: "Sensors" },
  { id: "operator", label: "Operator interface" },
  { id: "power", label: "Power" },
  { id: "safety", label: "Safety" },
  { id: "io", label: "Remote I/O" },
  { id: "other", label: "Other" },
];

/** Built-in starter inventory (common machine-builder stock) */
export function defaultCatalogItems() {
  return [
    {
      id: "seed_plc_s7",
      catalogName: "Siemens S7-1200 CPU",
      inventoryGroup: "plc",
      baseType: "plc",
      tagPrefix: "PLC",
      name: "S7-1200 CPU",
      manufacturer: "Siemens",
      partNumber: "6ES7214-1AG40-0XB0",
      description: "Compact CPU with onboard DI/DO",
      width: 140,
      height: 100,
      terminals: [
        { id: "L+", name: "+24V" },
        { id: "M", name: "0V" },
        { id: "PE", name: "PE" },
        { id: "DI0", name: "DI 0.0" },
        { id: "DI1", name: "DI 0.1" },
        { id: "DI2", name: "DI 0.2" },
        { id: "DI3", name: "DI 0.3" },
        { id: "DI4", name: "DI 0.4" },
        { id: "DI5", name: "DI 0.5" },
        { id: "DO0", name: "DO 0.0" },
        { id: "DO1", name: "DO 0.1" },
        { id: "COM", name: "COM" },
      ],
    },
    {
      id: "seed_ab_compact",
      catalogName: "AB CompactLogix",
      inventoryGroup: "plc",
      baseType: "plc",
      tagPrefix: "PLC",
      name: "CompactLogix",
      manufacturer: "Allen-Bradley",
      partNumber: "1769-L30ER",
      description: "CompactLogix controller",
      width: 150,
      height: 110,
      terminals: [
        { id: "24V", name: "+24V DC" },
        { id: "COM", name: "DC COM" },
        { id: "PE", name: "PE" },
        { id: "ENET", name: "ENET" },
        { id: "DI0", name: "I:0/0" },
        { id: "DI1", name: "I:0/1" },
        { id: "DI2", name: "I:0/2" },
        { id: "DI3", name: "I:0/3" },
        { id: "DO0", name: "O:0/0" },
        { id: "DO1", name: "O:0/1" },
      ],
    },
    {
      id: "seed_click_c0_10dd2e_d",
      catalogName: "CLICK PLC C0-10DD2E-D",
      inventoryGroup: "plc",
      baseType: "plc",
      tagPrefix: "PLC",
      name: "CLICK C0-10DD2E-D",
      manufacturer: "AutomationDirect / CLICK",
      partNumber: "C0-10DD2E-D",
      description:
        "CLICK Plus PLC — 8 DC inputs, 6 DC sinking outputs, Ethernet. Stackable I/O option.",
      width: 150,
      height: 120,
      terminals: [
        { id: "+V", name: "+24V DC power" },
        { id: "0V", name: "0V / DC common" },
        { id: "FG", name: "FG / PE" },
        { id: "ETH", name: "Ethernet" },
        // DC inputs X1–X8
        { id: "X1", name: "X1 DI" },
        { id: "X2", name: "X2 DI" },
        { id: "X3", name: "X3 DI" },
        { id: "X4", name: "X4 DI" },
        { id: "X5", name: "X5 DI" },
        { id: "X6", name: "X6 DI" },
        { id: "X7", name: "X7 DI" },
        { id: "X8", name: "X8 DI" },
        { id: "C0", name: "Input common C0" },
        // DC sinking outputs Y1–Y6
        { id: "Y1", name: "Y1 DO sink" },
        { id: "Y2", name: "Y2 DO sink" },
        { id: "Y3", name: "Y3 DO sink" },
        { id: "Y4", name: "Y4 DO sink" },
        { id: "Y5", name: "Y5 DO sink" },
        { id: "Y6", name: "Y6 DO sink" },
        { id: "C1", name: "Output common C1" },
      ],
    },
    {
      id: "seed_stridelinx_se_sl3011_wf",
      catalogName: "StrideLinx VPN Router PRO SE-SL3011-WF",
      inventoryGroup: "io",
      baseType: "plc",
      tagPrefix: "RTR",
      name: "StrideLinx SE-SL3011-WF",
      manufacturer: "AutomationDirect / StrideLinx",
      partNumber: "SE-SL3011-WF",
      description:
        "StrideLinx VPN Router PRO with Wi‑Fi — remote access VPN, LAN/WAN Ethernet, wireless. DIN-rail industrial router.",
      width: 140,
      height: 110,
      terminals: [
        { id: "+V", name: "+24V DC power" },
        { id: "0V", name: "0V / DC common" },
        { id: "PE", name: "PE / FG" },
        { id: "WAN", name: "WAN Ethernet" },
        { id: "LAN1", name: "LAN 1" },
        { id: "LAN2", name: "LAN 2" },
        { id: "LAN3", name: "LAN 3" },
        { id: "LAN4", name: "LAN 4" },
        { id: "WIFI", name: "Wi‑Fi antenna" },
        { id: "VPN", name: "VPN tunnel (logical)" },
        { id: "DI1", name: "DI 1 (status/I/O)" },
        { id: "DO1", name: "DO 1 (status/I/O)" },
      ],
    },
    {
      id: "seed_vfd_pf525",
      catalogName: "PowerFlex 525",
      inventoryGroup: "drives",
      baseType: "vfd",
      tagPrefix: "VFD",
      name: "PowerFlex 525",
      manufacturer: "Allen-Bradley",
      partNumber: "25B-D2P3N104",
      description: "0.75 kW / 1 HP VFD",
      width: 120,
      height: 110,
      terminals: [
        { id: "L1", name: "L1" },
        { id: "L2", name: "L2" },
        { id: "L3", name: "L3" },
        { id: "PE", name: "PE" },
        { id: "U", name: "U / T1" },
        { id: "V", name: "V / T2" },
        { id: "W", name: "W / T3" },
        { id: "DI1", name: "DI1 Start" },
        { id: "COM", name: "COM" },
        { id: "+24", name: "+24V" },
        { id: "AO", name: "Analog out" },
      ],
    },
    {
      id: "seed_motor_1hp",
      catalogName: "1HP TEFC motor",
      inventoryGroup: "drives",
      baseType: "motor",
      tagPrefix: "M",
      name: "1 HP conveyor motor",
      manufacturer: "Generic",
      partNumber: "MTR-1HP-1750",
      description: "3-ph 230/460V TEFC",
      width: 100,
      height: 90,
      terminals: [
        { id: "U1", name: "U1 / T1" },
        { id: "V1", name: "V1 / T2" },
        { id: "W1", name: "W1 / T3" },
        { id: "PE", name: "PE / GND" },
        { id: "TS+", name: "Therm +" },
        { id: "TS-", name: "Therm −" },
      ],
    },
    {
      id: "seed_sensor_banner",
      catalogName: "Banner QS18 photoeye",
      inventoryGroup: "sensors",
      baseType: "sensor",
      tagPrefix: "B",
      name: "QS18 photoeye",
      manufacturer: "Banner",
      partNumber: "QS18VN6D",
      description: "Diffuse PNP M12",
      width: 90,
      height: 70,
      terminals: [
        { id: "1", name: "BN +V" },
        { id: "2", name: "WH n/c" },
        { id: "3", name: "BU 0V" },
        { id: "4", name: "BK OUT" },
      ],
    },
    {
      id: "seed_sensor_ifm",
      catalogName: "ifm inductive prox",
      inventoryGroup: "sensors",
      baseType: "sensor",
      tagPrefix: "B",
      name: "Inductive prox M12",
      manufacturer: "ifm",
      partNumber: "IFS204",
      description: "PNP NO 3-wire",
      width: 90,
      height: 70,
      terminals: [
        { id: "1", name: "BN +V" },
        { id: "3", name: "BU 0V" },
        { id: "4", name: "BK OUT" },
      ],
    },
    {
      id: "seed_sensor_sick",
      catalogName: "SICK safety light curtain",
      inventoryGroup: "safety",
      baseType: "sensor",
      tagPrefix: "ES",
      name: "Safety light curtain",
      manufacturer: "SICK",
      partNumber: "C4C-EA03010A10000",
      description: "Sender/receiver pair landings",
      width: 110,
      height: 90,
      terminals: [
        { id: "24V", name: "+24V" },
        { id: "0V", name: "0V" },
        { id: "OSSD1", name: "OSSD1" },
        { id: "OSSD2", name: "OSSD2" },
        { id: "RESET", name: "Reset" },
        { id: "PE", name: "PE" },
      ],
    },
    {
      id: "seed_hmi_tp",
      catalogName: "Siemens Comfort Panel",
      inventoryGroup: "operator",
      baseType: "hmi",
      tagPrefix: "HMI",
      name: "TP700 Comfort",
      manufacturer: "Siemens",
      partNumber: "6AV2124-0GC01-0AX0",
      description: "7\" HMI panel",
      width: 110,
      height: 80,
      terminals: [
        { id: "L+", name: "+24V" },
        { id: "M", name: "0V" },
        { id: "PE", name: "PE" },
        { id: "PN1", name: "PROFINET 1" },
        { id: "PN2", name: "PROFINET 2" },
      ],
    },
    {
      id: "seed_pb_estop",
      catalogName: "E-stop illuminated",
      inventoryGroup: "safety",
      baseType: "pushbutton",
      tagPrefix: "ES",
      name: "E-stop pushbutton",
      manufacturer: "Schlegel",
      partNumber: "QRBTR",
      description: "NC+NO illuminated e-stop",
      width: 80,
      height: 75,
      terminals: [
        { id: "NC1", name: "NC 11" },
        { id: "NC2", name: "NC 12" },
        { id: "NO1", name: "NO 23" },
        { id: "NO2", name: "NO 24" },
        { id: "LED+", name: "Lamp +" },
        { id: "LED-", name: "Lamp −" },
      ],
    },
    {
      id: "seed_fuji_pb_mom_led_24v",
      catalogName: "Fuji Electric PB 24V LED Momentary",
      inventoryGroup: "operator",
      baseType: "pushbutton",
      tagPrefix: "PB",
      name: "Fuji PB momentary LED",
      manufacturer: "Fuji Electric",
      partNumber: "AR22F0L-10E3S",
      description: "22 mm momentary pushbutton with 24 V DC LED illumination (NO contact + lamp)",
      width: 80,
      height: 75,
      terminals: [
        { id: "NO1", name: "NO 3" },
        { id: "NO2", name: "NO 4" },
        { id: "NC1", name: "NC 1 (opt)" },
        { id: "NC2", name: "NC 2 (opt)" },
        { id: "LED+", name: "LED +24V X1" },
        { id: "LED-", name: "LED 0V X2" },
      ],
    },
    {
      id: "seed_fuji_pb_mom_led_24v_flush",
      catalogName: "Fuji Electric PB flush 24V LED Mom",
      inventoryGroup: "operator",
      baseType: "pushbutton",
      tagPrefix: "PB",
      name: "Fuji flush PB mom LED",
      manufacturer: "Fuji Electric",
      partNumber: "AR22F0R-10E3S",
      description: "22 mm flush momentary pushbutton, 24 V DC LED, NO contact block",
      width: 80,
      height: 75,
      terminals: [
        { id: "NO1", name: "NO 3" },
        { id: "NO2", name: "NO 4" },
        { id: "LED+", name: "LED +24V X1" },
        { id: "LED-", name: "LED 0V X2" },
      ],
    },
    {
      id: "seed_fuji_pb_mom_led_24v_ext",
      catalogName: "Fuji Electric PB extended 24V LED Mom",
      inventoryGroup: "operator",
      baseType: "pushbutton",
      tagPrefix: "PB",
      name: "Fuji extended PB mom LED",
      manufacturer: "Fuji Electric",
      partNumber: "AR22E0L-10E3S",
      description: "22 mm extended-head momentary pushbutton, 24 V DC LED",
      width: 80,
      height: 75,
      terminals: [
        { id: "NO1", name: "NO 3" },
        { id: "NO2", name: "NO 4" },
        { id: "NC1", name: "NC 1 (opt)" },
        { id: "NC2", name: "NC 2 (opt)" },
        { id: "LED+", name: "LED +24V X1" },
        { id: "LED-", name: "LED 0V X2" },
      ],
    },
    {
      id: "seed_k_contactor",
      catalogName: "IEC contactor 9A",
      inventoryGroup: "power",
      baseType: "contactor",
      tagPrefix: "K",
      name: "Contactor 9A",
      manufacturer: "ABB",
      partNumber: "AF09-30-10-13",
      description: "3-pole + aux 24V DC coil",
      width: 100,
      height: 90,
      terminals: [
        { id: "L1", name: "L1" },
        { id: "L2", name: "L2" },
        { id: "L3", name: "L3" },
        { id: "T1", name: "T1" },
        { id: "T2", name: "T2" },
        { id: "T3", name: "T3" },
        { id: "A1", name: "A1 Coil" },
        { id: "A2", name: "A2 Coil" },
        { id: "13", name: "NO 13" },
        { id: "14", name: "NO 14" },
      ],
    },
    {
      id: "seed_psu_24v",
      catalogName: "24V 10A PSU",
      inventoryGroup: "power",
      baseType: "psu",
      tagPrefix: "PS",
      name: "24V 10A supply",
      manufacturer: "Phoenix Contact",
      partNumber: "QUINT4-PS/1AC/24DC/10",
      description: "DIN rail power supply",
      width: 100,
      height: 80,
      terminals: [
        { id: "L", name: "L / Hot" },
        { id: "N", name: "N" },
        { id: "PE", name: "PE" },
        { id: "+V", name: "+24V" },
        { id: "0V", name: "0V" },
        { id: "PE2", name: "PE DC" },
      ],
    },
    {
      id: "seed_rio_et200",
      catalogName: "ET 200SP station",
      inventoryGroup: "io",
      baseType: "plc",
      tagPrefix: "RIO",
      name: "ET 200SP remote I/O",
      manufacturer: "Siemens",
      partNumber: "6ES7155-6AU01-0BN0",
      description: "PROFINET IM + sample DI/DO",
      width: 140,
      height: 100,
      terminals: [
        { id: "L+", name: "+24V" },
        { id: "M", name: "0V" },
        { id: "PE", name: "PE" },
        { id: "PN", name: "PROFINET" },
        { id: "DI0", name: "DI 0" },
        { id: "DI1", name: "DI 1" },
        { id: "DI2", name: "DI 2" },
        { id: "DI3", name: "DI 3" },
        { id: "DO0", name: "DO 0" },
        { id: "DO1", name: "DO 1" },
      ],
    },
  ];
}

let _items = null;

export function loadCatalog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.items) && data.items.length) {
        _items = data.items;
        ensureSeedItems();
        return _items;
      }
    }
  } catch {
    /* ignore */
  }
  _items = defaultCatalogItems();
  saveCatalog();
  return _items;
}

/** Add any new built-in seed items missing from an existing catalog (by id). */
function ensureSeedItems() {
  if (!_items) return;
  let changed = false;
  for (const seed of defaultCatalogItems()) {
    if (!_items.some((i) => i.id === seed.id)) {
      _items.push(deepClone(seed));
      changed = true;
    }
  }
  if (changed) saveCatalog();
}

export function getCatalogItems() {
  if (!_items) loadCatalog();
  return _items;
}

export function saveCatalog() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        items: _items || [],
      })
    );
  } catch {
    /* quota */
  }
}

export function getCatalogItem(id) {
  return getCatalogItems().find((i) => i.id === id) || null;
}

export function catalogByGroup() {
  const items = getCatalogItems();
  const groups = INVENTORY_GROUPS.map((g) => ({
    ...g,
    items: items.filter((i) => (i.inventoryGroup || "other") === g.id),
  }));
  const known = new Set(INVENTORY_GROUPS.map((g) => g.id));
  const orphan = items.filter((i) => !known.has(i.inventoryGroup || "other"));
  if (orphan.length) {
    const other = groups.find((g) => g.id === "other");
    if (other) other.items.push(...orphan);
  }
  return groups.filter((g) => g.items.length);
}

/**
 * Snapshot a canvas node into a catalog inventory item.
 */
export function itemFromNode(node, opts = {}) {
  const base = findCatalogEntry(node.type);
  return {
    id: uid("cat"),
    catalogName:
      opts.catalogName ||
      [node.manufacturer, node.partNumber || node.name].filter(Boolean).join(" ") ||
      node.name ||
      node.tag,
    inventoryGroup: opts.inventoryGroup || guessGroup(node),
    baseType: node.type,
    tagPrefix: opts.tagPrefix || extractTagPrefix(node.tag, base?.tagPrefix || "X"),
    name: node.name || base?.label || node.type,
    manufacturer: node.manufacturer || "",
    partNumber: node.partNumber || "",
    description: node.description || "",
    width: node.width,
    height: node.height,
    terminals: deepClone(node.terminals || []),
    mateCoding: node.mateCoding || "",
    matePins: node.matePins || 0,
    mateFace: node.mateFace || "",
    category: node.category || base?.category || "device",
    createdAt: new Date().toISOString(),
  };
}

function guessGroup(node) {
  const t = node.type || "";
  if (t === "plc") return "plc";
  if (t === "vfd" || t === "motor" || t === "contactor") return "drives";
  if (t === "sensor") return "sensors";
  if (t === "hmi" || t === "pushbutton") return "operator";
  if (t === "psu") return "power";
  return "other";
}

function extractTagPrefix(tag, fallback) {
  const m = String(tag || "").match(/^([A-Za-z]+)/);
  return m ? m[1] : fallback;
}

export function addCatalogItem(item) {
  getCatalogItems();
  const entry = { ...item, id: item.id || uid("cat") };
  _items.push(entry);
  saveCatalog();
  return entry;
}

export function updateCatalogItem(id, patch) {
  getCatalogItems();
  const idx = _items.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  _items[idx] = { ..._items[idx], ...patch, id };
  saveCatalog();
  return _items[idx];
}

export function removeCatalogItem(id) {
  getCatalogItems();
  const before = _items.length;
  _items = _items.filter((i) => i.id !== id);
  saveCatalog();
  return _items.length < before;
}

export function replaceCatalog(items) {
  _items = Array.isArray(items) ? items : [];
  saveCatalog();
  return _items;
}

export function resetCatalogToDefaults() {
  _items = defaultCatalogItems();
  saveCatalog();
  return _items;
}

export function exportCatalogJson() {
  return JSON.stringify(
    {
      version: 1,
      type: "raiv-wire-device-catalog",
      exportedAt: new Date().toISOString(),
      items: getCatalogItems(),
    },
    null,
    2
  );
}

export function importCatalogJson(text, mode = "merge") {
  const data = JSON.parse(text);
  const incoming = data.items || data;
  if (!Array.isArray(incoming)) throw new Error("Invalid catalog file");
  return mergeCatalogItems(incoming, mode);
}

/** Merge or replace catalog with normalized raw items */
export function mergeCatalogItems(incoming, mode = "merge") {
  if (!Array.isArray(incoming)) throw new Error("Invalid catalog items");
  if (mode === "replace") {
    replaceCatalog(incoming.map(normalizeItem));
  } else {
    getCatalogItems();
    for (const raw of incoming) {
      const item = normalizeItem(raw);
      const existing = _items.find(
        (i) =>
          i.id === item.id ||
          (i.partNumber &&
            item.partNumber &&
            i.partNumber === item.partNumber &&
            i.catalogName === item.catalogName)
      );
      if (existing) {
        Object.assign(existing, item, { id: existing.id });
      } else {
        if (_items.some((i) => i.id === item.id)) item.id = uid("cat");
        _items.push(item);
      }
    }
    saveCatalog();
  }
  return _items;
}

function normalizeItem(raw) {
  let terminals = raw.terminals;
  if (typeof terminals === "string" && terminals.trim()) {
    try {
      terminals = JSON.parse(terminals);
    } catch {
      // "1:BN +V | 2:WH | 3:BU 0V" style
      terminals = terminals.split("|").map((part, i) => {
        const p = part.trim();
        const m = p.match(/^([^:]+):\s*(.*)$/);
        if (m) return { id: m[1].trim(), name: m[2].trim() || m[1].trim() };
        return { id: String(i + 1), name: p };
      });
    }
  }
  if (!Array.isArray(terminals) || !terminals.length) {
    terminals = [{ id: "1", name: "1" }];
  }

  return {
    id: raw.id || uid("cat"),
    catalogName: raw.catalogName || raw.name || "Catalog item",
    inventoryGroup: raw.inventoryGroup || "other",
    baseType: raw.baseType || raw.type || "sensor",
    tagPrefix: raw.tagPrefix || "X",
    name: raw.name || raw.catalogName || "Device",
    manufacturer: raw.manufacturer || "",
    partNumber: raw.partNumber || "",
    description: raw.description || "",
    width: Number(raw.width) || 100,
    height: Number(raw.height) || 80,
    terminals: deepClone(terminals),
    mateCoding: raw.mateCoding || "",
    matePins: Number(raw.matePins) || 0,
    mateFace: raw.mateFace || "",
    category:
      raw.category ||
      findCatalogEntry(raw.baseType || raw.type)?.category ||
      "device",
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

// ── Excel / CSV spreadsheet I/O ──

const DEVICE_HEADERS = [
  "id",
  "catalogName",
  "inventoryGroup",
  "baseType",
  "tagPrefix",
  "name",
  "manufacturer",
  "partNumber",
  "description",
  "width",
  "height",
  "category",
  "mateCoding",
  "matePins",
  "mateFace",
  "terminals",
  "createdAt",
];

const TERMINAL_HEADERS = [
  "catalogId",
  "catalogName",
  "termId",
  "termName",
  "matePin",
  "side",
  "sortOrder",
];

/** SheetJS loaded on demand from CDN (for .xlsx) */
let _XLSX = null;
const SHEETJS_CDN = "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";

export async function loadSheetJS() {
  if (_XLSX) return _XLSX;
  try {
    _XLSX = await import(SHEETJS_CDN);
    return _XLSX;
  } catch (err) {
    throw new Error(
      "Could not load Excel library (network required for .xlsx). Use CSV export/import offline, or check connectivity. " +
        (err.message || "")
    );
  }
}

function itemsToDeviceRows(items) {
  return items.map((item) => ({
    id: item.id || "",
    catalogName: item.catalogName || "",
    inventoryGroup: item.inventoryGroup || "other",
    baseType: item.baseType || "",
    tagPrefix: item.tagPrefix || "",
    name: item.name || "",
    manufacturer: item.manufacturer || "",
    partNumber: item.partNumber || "",
    description: item.description || "",
    width: item.width ?? "",
    height: item.height ?? "",
    category: item.category || "",
    mateCoding: item.mateCoding || "",
    matePins: item.matePins ?? "",
    mateFace: item.mateFace || "",
    terminals: JSON.stringify(item.terminals || []),
    createdAt: item.createdAt || "",
  }));
}

function itemsToTerminalRows(items) {
  const rows = [];
  for (const item of items) {
    (item.terminals || []).forEach((t, i) => {
      rows.push({
        catalogId: item.id || "",
        catalogName: item.catalogName || "",
        termId: t.id || "",
        termName: t.name || "",
        matePin: t.matePin || "",
        side: t.side || "",
        sortOrder: i + 1,
      });
    });
  }
  return rows;
}

function rowsToItems(deviceRows, terminalRows = []) {
  const termsById = new Map();
  for (const tr of terminalRows) {
    const cid = String(tr.catalogId || "").trim();
    if (!cid) continue;
    if (!termsById.has(cid)) termsById.set(cid, []);
    termsById.get(cid).push({
      id: String(tr.termId || "").trim() || "1",
      name: String(tr.termName || tr.termId || "").trim() || "1",
      matePin: String(tr.matePin || "").trim(),
      side: String(tr.side || "").trim(),
      _sort: Number(tr.sortOrder) || 0,
    });
  }
  for (const [, list] of termsById) {
    list.sort((a, b) => a._sort - b._sort);
    list.forEach((t) => delete t._sort);
  }

  return deviceRows
    .filter((r) => r.catalogName || r.name || r.partNumber)
    .map((r) => {
      const id = String(r.id || "").trim();
      let terminals = termsById.get(id);
      if (!terminals?.length && r.terminals) {
        // from JSON column
        const raw = { ...r, terminals: r.terminals };
        return normalizeItem(raw);
      }
      return normalizeItem({
        ...r,
        terminals: terminals?.length
          ? terminals.map(({ id: tid, name, matePin, side }) => ({
              id: tid,
              name,
              ...(matePin ? { matePin } : {}),
              ...(side ? { side } : {}),
            }))
          : r.terminals,
      });
    });
}

/**
 * Export catalog as Excel .xlsx (Devices + Terminals sheets).
 * Returns a Blob. Requires network once to load SheetJS.
 */
export async function exportCatalogExcel() {
  const XLSX = await loadSheetJS();
  const items = getCatalogItems();
  const wb = XLSX.utils.book_new();

  const deviceRows = itemsToDeviceRows(items);
  const wsDevices = XLSX.utils.json_to_sheet(deviceRows, { header: DEVICE_HEADERS });
  wsDevices["!cols"] = DEVICE_HEADERS.map((h) => ({
    wch: h === "terminals" || h === "description" ? 40 : h === "catalogName" ? 28 : 14,
  }));
  XLSX.utils.book_append_sheet(wb, wsDevices, "Devices");

  const termRows = itemsToTerminalRows(items);
  const wsTerms = XLSX.utils.json_to_sheet(
    termRows.length ? termRows : [{ catalogId: "", catalogName: "", termId: "", termName: "", matePin: "", side: "", sortOrder: "" }],
    { header: TERMINAL_HEADERS }
  );
  wsTerms["!cols"] = TERMINAL_HEADERS.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, wsTerms, "Terminals");

  // Readme sheet
  const help = [
    { Field: "How to use", Value: "Edit Devices and/or Terminals, then Import in RAIV Wire (merge or replace)." },
    { Field: "inventoryGroup", Value: "plc | drives | sensors | operator | power | safety | io | other" },
    { Field: "baseType", Value: "plc | vfd | motor | sensor | hmi | pushbutton | contactor | psu | …" },
    { Field: "terminals (Devices)", Value: 'JSON array e.g. [{"id":"1","name":"BN +V"}] — or use Terminals sheet' },
    { Field: "Terminals sheet", Value: "One row per landing; catalogId must match Devices.id" },
    { Field: "Export date", Value: new Date().toISOString() },
  ];
  const wsHelp = XLSX.utils.json_to_sheet(help);
  wsHelp["!cols"] = [{ wch: 22 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsHelp, "Readme");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Export catalog as CSV (Excel-compatible). Works fully offline.
 */
export function exportCatalogCsv() {
  const items = getCatalogItems();
  const rows = itemsToDeviceRows(items);
  const lines = [DEVICE_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(
      DEVICE_HEADERS.map((h) => csvEscape(row[h] ?? "")).join(",")
    );
  }
  // BOM for Excel UTF-8
  return "\uFEFF" + lines.join("\r\n");
}

function csvEscape(val) {
  const s = String(val ?? "");
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Import catalog from Excel .xlsx / .xls ArrayBuffer.
 */
export async function importCatalogExcel(arrayBuffer, mode = "merge") {
  const XLSX = await loadSheetJS();
  const wb = XLSX.read(arrayBuffer, { type: "array" });

  const deviceSheetName =
    wb.SheetNames.find((n) => /^devices?$/i.test(n)) ||
    wb.SheetNames.find((n) => !/^terminals?$/i.test(n) && !/^readme$/i.test(n)) ||
    wb.SheetNames[0];
  const termSheetName = wb.SheetNames.find((n) => /^terminals?$/i.test(n));

  if (!deviceSheetName) throw new Error("No worksheet found in Excel file");

  const deviceRows = XLSX.utils.sheet_to_json(wb.Sheets[deviceSheetName], {
    defval: "",
    raw: false,
  });
  const terminalRows = termSheetName
    ? XLSX.utils.sheet_to_json(wb.Sheets[termSheetName], { defval: "", raw: false })
    : [];

  if (!deviceRows.length) throw new Error("Devices sheet is empty");

  // Normalize header aliases (Catalog Name → catalogName)
  const normRows = deviceRows.map(normalizeSpreadsheetRow);
  const normTerms = terminalRows.map(normalizeSpreadsheetRow);

  return mergeCatalogItems(rowsToItems(normRows, normTerms), mode);
}

/**
 * Import catalog from CSV text (Devices-style columns).
 */
export function importCatalogCsv(text, mode = "merge") {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error("CSV is empty");
  const normRows = rows.map(normalizeSpreadsheetRow);
  return mergeCatalogItems(rowsToItems(normRows, []), mode);
}

function normalizeSpreadsheetRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const key = String(k)
      .trim()
      .replace(/^\uFEFF/, "")
      .replace(/\s+/g, "")
      .replace(/_/g, "");
    // map common labels
    const map = {
      id: "id",
      catalogname: "catalogName",
      catalog: "catalogName",
      inventorygroup: "inventoryGroup",
      group: "inventoryGroup",
      basetype: "baseType",
      type: "baseType",
      tagprefix: "tagPrefix",
      prefix: "tagPrefix",
      name: "name",
      manufacturer: "manufacturer",
      mfr: "manufacturer",
      partnumber: "partNumber",
      partno: "partNumber",
      pn: "partNumber",
      description: "description",
      notes: "description",
      width: "width",
      height: "height",
      category: "category",
      matecoding: "mateCoding",
      matepins: "matePins",
      mateface: "mateFace",
      terminals: "terminals",
      createdat: "createdAt",
      catalogid: "catalogId",
      termid: "termId",
      termname: "termName",
      matepin: "matePin",
      side: "side",
      sortorder: "sortOrder",
    };
    const canon = map[key.toLowerCase()] || key;
    out[canon] = v;
  }
  return out;
}

/** Minimal CSV parser supporting quotes */
function parseCsv(text) {
  const cleaned = String(text || "").replace(/^\uFEFF/, "");
  const lines = [];
  let i = 0;
  let field = "";
  let row = [];
  let inQuotes = false;
  while (i < cleaned.length) {
    const c = cleaned[i];
    if (inQuotes) {
      if (c === '"') {
        if (cleaned[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && cleaned[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => String(cell).trim() !== "")) lines.push(row);
      row = [];
      i++;
      continue;
    }
    field += c;
    i++;
  }
  row.push(field);
  if (row.some((cell) => String(cell).trim() !== "")) lines.push(row);

  if (!lines.length) return [];
  const headers = lines[0].map((h) => String(h).trim());
  return lines.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? "";
    });
    return obj;
  });
}

/**
 * Auto-detect format and import catalog file contents.
 * @param {File} file
 * @param {"merge"|"replace"} mode
 */
export async function importCatalogFile(file, mode = "merge") {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".json")) {
    const text = await file.text();
    return importCatalogJson(text, mode);
  }
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const text = await file.text();
    return importCatalogCsv(text, mode);
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    return importCatalogExcel(buf, mode);
  }
  // sniff
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf.slice(0, 4));
  // PK.. zip / xlsx
  if (head[0] === 0x50 && head[1] === 0x4b) {
    return importCatalogExcel(buf, mode);
  }
  const text = new TextDecoder().decode(buf);
  if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
    return importCatalogJson(text, mode);
  }
  return importCatalogCsv(text, mode);
}

/**
 * Place a catalog inventory item as a new diagram node.
 */
export function createNodeFromCatalogItem(item, x, y, existingNodes = []) {
  const base = findCatalogEntry(item.baseType) || findCatalogEntry("sensor");
  const tagPrefix = item.tagPrefix || base?.tagPrefix || "X";
  return {
    id: uid("node"),
    type: item.baseType || base?.type || "sensor",
    category: item.category || base?.category || "device",
    tag: nextTag(existingNodes, tagPrefix),
    name: item.name || item.catalogName,
    description: item.description || "",
    x: Math.round(x),
    y: Math.round(y),
    width: item.width || base?.width || 100,
    height: item.height || base?.height || 80,
    terminals: deepClone(item.terminals || base?.defaultTerminals || []),
    location: "",
    manufacturer: item.manufacturer || "",
    partNumber: item.partNumber || "",
    catalogId: item.id,
    catalogName: item.catalogName,
    mateCoding: item.mateCoding || "",
    matePins: item.matePins || 0,
    mateFace: item.mateFace || "",
    isBulkhead: (item.category || base?.category) === "connector",
  };
}
