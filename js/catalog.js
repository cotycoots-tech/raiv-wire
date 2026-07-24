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
  if (mode === "replace") {
    replaceCatalog(incoming.map(normalizeItem));
  } else {
    getCatalogItems();
    for (const raw of incoming) {
      const item = normalizeItem(raw);
      const existing = _items.find(
        (i) =>
          i.id === item.id ||
          (i.partNumber && item.partNumber && i.partNumber === item.partNumber && i.catalogName === item.catalogName)
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
    width: raw.width || 100,
    height: raw.height || 80,
    terminals: deepClone(raw.terminals || [{ id: "1", name: "1" }]),
    mateCoding: raw.mateCoding || "",
    matePins: raw.matePins || 0,
    mateFace: raw.mateFace || "",
    category: raw.category || findCatalogEntry(raw.baseType || raw.type)?.category || "device",
    createdAt: raw.createdAt || new Date().toISOString(),
  };
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
