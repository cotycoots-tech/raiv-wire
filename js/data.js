/**
 * RAIV Wire — domain data: wire colors, component catalogs, project model helpers
 */

/** Industrial / machine-builder wire colors (IEC + common NA practice) */
export const WIRE_COLORS = [
  { id: "BK", name: "Black", hex: "#1a1a1a", stroke: "#333333", usage: "AC hot / L1, DC+" },
  { id: "RD", name: "Red", hex: "#dc2626", stroke: "#ef4444", usage: "AC hot / L2, interlock" },
  { id: "BU", name: "Blue", hex: "#2563eb", stroke: "#3b82f6", usage: "DC− / N (IEC), control" },
  { id: "WH", name: "White", hex: "#f1f5f9", stroke: "#e2e8f0", usage: "Neutral (NA)" },
  { id: "GNYE", name: "Green/Yellow", hex: "#22c55e", stroke: "#4ade80", striped: true, stripe: "#eab308", usage: "Protective earth (PE)" },
  { id: "GN", name: "Green", hex: "#16a34a", stroke: "#22c55e", usage: "Ground (NA legacy)" },
  { id: "BN", name: "Brown", hex: "#92400e", stroke: "#b45309", usage: "AC L1 (IEC)" },
  { id: "GY", name: "Gray", hex: "#6b7280", stroke: "#9ca3af", usage: "AC L (IEC), signal" },
  { id: "OG", name: "Orange", hex: "#ea580c", stroke: "#f97316", usage: "Ungrounded control / interlock" },
  { id: "YE", name: "Yellow", hex: "#ca8a04", stroke: "#eab308", usage: "Interlock, caution circuits" },
  { id: "VT", name: "Violet", hex: "#7c3aed", stroke: "#8b5cf6", usage: "Foreign voltage" },
  { id: "PK", name: "Pink", hex: "#db2777", stroke: "#ec4899", usage: "Signal / specialty" },
  { id: "TQ", name: "Turquoise", hex: "#0d9488", stroke: "#14b8a6", usage: "Data / specialty" },
  { id: "SH", name: "Shield / Drain", hex: "#a8a29e", stroke: "#d6d3d1", usage: "Cable shield / drain wire" },
];

export const colorById = (id) => WIRE_COLORS.find((c) => c.id === id) || WIRE_COLORS[0];

/**
 * Cable templates — open/bulk wire and factory-terminated cordsets.
 * terminated: false = cut-to-length bulk cable (open ends)
 * terminated: true  = pre-terminated cordset with defined endA / endB
 */
export const CABLE_TEMPLATES = [
  // ── Open / bulk (not terminated) ──
  {
    id: "2c-power",
    name: "2C Power",
    awg: "14",
    type: "Power",
    terminated: false,
    conductors: [
      { color: "BK", label: "L1" },
      { color: "WH", label: "N" },
    ],
  },
  {
    id: "3c-power",
    name: "3C Power + PE",
    awg: "14",
    type: "Power",
    terminated: false,
    conductors: [
      { color: "BK", label: "L1" },
      { color: "WH", label: "N" },
      { color: "GNYE", label: "PE" },
    ],
  },
  {
    id: "4c-3ph",
    name: "4C 3-Phase + PE",
    awg: "12",
    type: "Power",
    terminated: false,
    conductors: [
      { color: "BK", label: "L1" },
      { color: "RD", label: "L2" },
      { color: "BU", label: "L3" },
      { color: "GNYE", label: "PE" },
    ],
  },
  {
    id: "5c-3ph-n",
    name: "5C 3-Phase + N + PE",
    awg: "12",
    type: "Power",
    terminated: false,
    conductors: [
      { color: "BN", label: "L1" },
      { color: "BK", label: "L2" },
      { color: "GY", label: "L3" },
      { color: "BU", label: "N" },
      { color: "GNYE", label: "PE" },
    ],
  },
  {
    id: "2c-control",
    name: "2C Control",
    awg: "18",
    type: "Control",
    terminated: false,
    conductors: [
      { color: "RD", label: "+24V" },
      { color: "BU", label: "0V" },
    ],
  },
  {
    id: "3c-control",
    name: "3C Control",
    awg: "18",
    type: "Control",
    terminated: false,
    conductors: [
      { color: "RD", label: "+24V" },
      { color: "BU", label: "0V" },
      { color: "GNYE", label: "PE" },
    ],
  },
  {
    id: "4c-signal",
    name: "4C Signal",
    awg: "22",
    type: "Signal",
    terminated: false,
    conductors: [
      { color: "BN", label: "Supply" },
      { color: "WH", label: "Signal" },
      { color: "BU", label: "Common" },
      { color: "BK", label: "Spare" },
    ],
  },
  {
    id: "shielded-pair",
    name: "Shielded pair",
    awg: "22",
    type: "Signal",
    terminated: false,
    conductors: [
      { color: "WH", label: "A / +" },
      { color: "BU", label: "B / −" },
      { color: "SH", label: "Drain" },
    ],
  },
  {
    id: "sensor-3w",
    name: "3-wire sensor",
    awg: "22",
    type: "Sensor",
    terminated: false,
    conductors: [
      { color: "BN", label: "+V" },
      { color: "BK", label: "OUT" },
      { color: "BU", label: "0V" },
    ],
  },
  {
    id: "sensor-4w",
    name: "4-wire sensor",
    awg: "22",
    type: "Sensor",
    terminated: false,
    conductors: [
      { color: "BN", label: "+V" },
      { color: "WH", label: "OUT1" },
      { color: "BK", label: "OUT2" },
      { color: "BU", label: "0V" },
    ],
  },

  // ── Terminated cordsets ──
  {
    id: "term-m12-4f-leads",
    name: "M12-4F → leads",
    awg: "22",
    type: "Sensor",
    terminated: true,
    subcategory: "m12-sensor",
    defaultLength: "5 m",
    endA: { kind: "M12-A", gender: "female", pins: 4, label: "M12-4F" },
    endB: { kind: "flying-leads", gender: null, pins: 4, label: "Flying leads" },
    conductors: [
      { color: "BN", label: "1 / +V", pinA: "1", pinB: "BN" },
      { color: "WH", label: "2 / SIG", pinA: "2", pinB: "WH" },
      { color: "BU", label: "3 / 0V", pinA: "3", pinB: "BU" },
      { color: "BK", label: "4 / OUT", pinA: "4", pinB: "BK" },
    ],
  },
  {
    id: "term-m12-4m-leads",
    name: "M12-4M → leads",
    awg: "22",
    type: "Sensor",
    terminated: true,
    subcategory: "m12-sensor",
    defaultLength: "5 m",
    endA: { kind: "M12-A", gender: "male", pins: 4, label: "M12-4M" },
    endB: { kind: "flying-leads", gender: null, pins: 4, label: "Flying leads" },
    conductors: [
      { color: "BN", label: "1 / +V", pinA: "1", pinB: "BN" },
      { color: "WH", label: "2 / SIG", pinA: "2", pinB: "WH" },
      { color: "BU", label: "3 / 0V", pinA: "3", pinB: "BU" },
      { color: "BK", label: "4 / OUT", pinA: "4", pinB: "BK" },
    ],
  },
  {
    id: "term-m12-4f-4m",
    name: "M12-4F → M12-4M",
    awg: "22",
    type: "Sensor",
    terminated: true,
    subcategory: "m12-sensor",
    defaultLength: "2 m",
    endA: { kind: "M12-A", gender: "female", pins: 4, label: "M12-4F" },
    endB: { kind: "M12-A", gender: "male", pins: 4, label: "M12-4M" },
    conductors: [
      { color: "BN", label: "1 / +V", pinA: "1", pinB: "1" },
      { color: "WH", label: "2 / SIG", pinA: "2", pinB: "2" },
      { color: "BU", label: "3 / 0V", pinA: "3", pinB: "3" },
      { color: "BK", label: "4 / OUT", pinA: "4", pinB: "4" },
    ],
  },
  {
    id: "term-m12-4f-4f",
    name: "M12-4F → M12-4F",
    awg: "22",
    type: "Sensor",
    terminated: true,
    subcategory: "m12-sensor",
    defaultLength: "1 m",
    endA: { kind: "M12-A", gender: "female", pins: 4, label: "M12-4F" },
    endB: { kind: "M12-A", gender: "female", pins: 4, label: "M12-4F" },
    conductors: [
      { color: "BN", label: "1 / +V", pinA: "1", pinB: "1" },
      { color: "WH", label: "2", pinA: "2", pinB: "2" },
      { color: "BU", label: "3 / 0V", pinA: "3", pinB: "3" },
      { color: "BK", label: "4 / OUT", pinA: "4", pinB: "4" },
    ],
  },
  {
    id: "term-m12-5f-leads",
    name: "M12-5F → leads",
    awg: "22",
    type: "Sensor",
    terminated: true,
    subcategory: "m12-sensor",
    defaultLength: "5 m",
    endA: { kind: "M12-A", gender: "female", pins: 5, label: "M12-5F" },
    endB: { kind: "flying-leads", gender: null, pins: 5, label: "Flying leads" },
    conductors: [
      { color: "BN", label: "1 / +V", pinA: "1", pinB: "BN" },
      { color: "WH", label: "2", pinA: "2", pinB: "WH" },
      { color: "BU", label: "3 / 0V", pinA: "3", pinB: "BU" },
      { color: "BK", label: "4", pinA: "4", pinB: "BK" },
      { color: "GY", label: "5", pinA: "5", pinB: "GY" },
    ],
  },
  {
    id: "term-m12-5f-5m",
    name: "M12-5F → M12-5M",
    awg: "22",
    type: "Sensor",
    terminated: true,
    subcategory: "m12-sensor",
    defaultLength: "2 m",
    endA: { kind: "M12-A", gender: "female", pins: 5, label: "M12-5F" },
    endB: { kind: "M12-A", gender: "male", pins: 5, label: "M12-5M" },
    conductors: [
      { color: "BN", label: "1", pinA: "1", pinB: "1" },
      { color: "WH", label: "2", pinA: "2", pinB: "2" },
      { color: "BU", label: "3", pinA: "3", pinB: "3" },
      { color: "BK", label: "4", pinA: "4", pinB: "4" },
      { color: "GY", label: "5", pinA: "5", pinB: "5" },
    ],
  },
  {
    id: "term-m12-8f-leads",
    name: "M12-8F → leads",
    awg: "24",
    type: "Signal",
    terminated: true,
    subcategory: "m12-multipin",
    defaultLength: "5 m",
    endA: { kind: "M12-A", gender: "female", pins: 8, label: "M12-8F" },
    endB: { kind: "flying-leads", gender: null, pins: 8, label: "Flying leads" },
    conductors: [
      { color: "WH", label: "1", pinA: "1", pinB: "WH" },
      { color: "BN", label: "2", pinA: "2", pinB: "BN" },
      { color: "GN", label: "3", pinA: "3", pinB: "GN" },
      { color: "YE", label: "4", pinA: "4", pinB: "YE" },
      { color: "GY", label: "5", pinA: "5", pinB: "GY" },
      { color: "PK", label: "6", pinA: "6", pinB: "PK" },
      { color: "BU", label: "7", pinA: "7", pinB: "BU" },
      { color: "RD", label: "8", pinA: "8", pinB: "RD" },
    ],
  },
  {
    id: "term-m12-8m-leads",
    name: "M12-8M → leads",
    awg: "24",
    type: "Signal",
    terminated: true,
    subcategory: "m12-multipin",
    defaultLength: "5 m",
    endA: { kind: "M12-A", gender: "male", pins: 8, label: "M12-8M" },
    endB: { kind: "flying-leads", gender: null, pins: 8, label: "Flying leads" },
    conductors: [
      { color: "WH", label: "1", pinA: "1", pinB: "WH" },
      { color: "BN", label: "2", pinA: "2", pinB: "BN" },
      { color: "GN", label: "3", pinA: "3", pinB: "GN" },
      { color: "YE", label: "4", pinA: "4", pinB: "YE" },
      { color: "GY", label: "5", pinA: "5", pinB: "GY" },
      { color: "PK", label: "6", pinA: "6", pinB: "PK" },
      { color: "BU", label: "7", pinA: "7", pinB: "BU" },
      { color: "RD", label: "8", pinA: "8", pinB: "RD" },
    ],
  },
  {
    id: "term-m12-8f-8m",
    name: "M12-8F → M12-8M",
    awg: "24",
    type: "Signal",
    terminated: true,
    subcategory: "m12-multipin",
    defaultLength: "2 m",
    endA: { kind: "M12-A", gender: "female", pins: 8, label: "M12-8F" },
    endB: { kind: "M12-A", gender: "male", pins: 8, label: "M12-8M" },
    conductors: [
      { color: "WH", label: "1", pinA: "1", pinB: "1" },
      { color: "BN", label: "2", pinA: "2", pinB: "2" },
      { color: "GN", label: "3", pinA: "3", pinB: "3" },
      { color: "YE", label: "4", pinA: "4", pinB: "4" },
      { color: "GY", label: "5", pinA: "5", pinB: "5" },
      { color: "PK", label: "6", pinA: "6", pinB: "6" },
      { color: "BU", label: "7", pinA: "7", pinB: "7" },
      { color: "RD", label: "8", pinA: "8", pinB: "8" },
    ],
  },
  {
    id: "term-m12-12f-leads",
    name: "M12-12F → leads",
    awg: "24",
    type: "Signal",
    terminated: true,
    subcategory: "m12-multipin",
    defaultLength: "5 m",
    endA: { kind: "M12-A", gender: "female", pins: 12, label: "M12-12F" },
    endB: { kind: "flying-leads", gender: null, pins: 12, label: "Flying leads" },
    conductors: [
      { color: "WH", label: "1", pinA: "1", pinB: "WH" },
      { color: "BN", label: "2", pinA: "2", pinB: "BN" },
      { color: "GN", label: "3", pinA: "3", pinB: "GN" },
      { color: "YE", label: "4", pinA: "4", pinB: "YE" },
      { color: "GY", label: "5", pinA: "5", pinB: "GY" },
      { color: "PK", label: "6", pinA: "6", pinB: "PK" },
      { color: "BU", label: "7", pinA: "7", pinB: "BU" },
      { color: "RD", label: "8", pinA: "8", pinB: "RD" },
      { color: "OG", label: "9", pinA: "9", pinB: "OG" },
      { color: "VT", label: "10", pinA: "10", pinB: "VT" },
      { color: "TQ", label: "11", pinA: "11", pinB: "TQ" },
      { color: "BK", label: "12", pinA: "12", pinB: "BK" },
    ],
  },
  {
    id: "term-m12-12m-leads",
    name: "M12-12M → leads",
    awg: "24",
    type: "Signal",
    terminated: true,
    subcategory: "m12-multipin",
    defaultLength: "5 m",
    endA: { kind: "M12-A", gender: "male", pins: 12, label: "M12-12M" },
    endB: { kind: "flying-leads", gender: null, pins: 12, label: "Flying leads" },
    conductors: [
      { color: "WH", label: "1", pinA: "1", pinB: "WH" },
      { color: "BN", label: "2", pinA: "2", pinB: "BN" },
      { color: "GN", label: "3", pinA: "3", pinB: "GN" },
      { color: "YE", label: "4", pinA: "4", pinB: "YE" },
      { color: "GY", label: "5", pinA: "5", pinB: "GY" },
      { color: "PK", label: "6", pinA: "6", pinB: "PK" },
      { color: "BU", label: "7", pinA: "7", pinB: "BU" },
      { color: "RD", label: "8", pinA: "8", pinB: "RD" },
      { color: "OG", label: "9", pinA: "9", pinB: "OG" },
      { color: "VT", label: "10", pinA: "10", pinB: "VT" },
      { color: "TQ", label: "11", pinA: "11", pinB: "TQ" },
      { color: "BK", label: "12", pinA: "12", pinB: "BK" },
    ],
  },
  {
    id: "term-m12-12f-12m",
    name: "M12-12F → M12-12M",
    awg: "24",
    type: "Signal",
    terminated: true,
    subcategory: "m12-multipin",
    defaultLength: "2 m",
    endA: { kind: "M12-A", gender: "female", pins: 12, label: "M12-12F" },
    endB: { kind: "M12-A", gender: "male", pins: 12, label: "M12-12M" },
    conductors: [
      { color: "WH", label: "1", pinA: "1", pinB: "1" },
      { color: "BN", label: "2", pinA: "2", pinB: "2" },
      { color: "GN", label: "3", pinA: "3", pinB: "3" },
      { color: "YE", label: "4", pinA: "4", pinB: "4" },
      { color: "GY", label: "5", pinA: "5", pinB: "5" },
      { color: "PK", label: "6", pinA: "6", pinB: "6" },
      { color: "BU", label: "7", pinA: "7", pinB: "7" },
      { color: "RD", label: "8", pinA: "8", pinB: "8" },
      { color: "OG", label: "9", pinA: "9", pinB: "9" },
      { color: "VT", label: "10", pinA: "10", pinB: "10" },
      { color: "TQ", label: "11", pinA: "11", pinB: "11" },
      { color: "BK", label: "12", pinA: "12", pinB: "12" },
    ],
  },
  // ── Ethernet / industrial network cordsets ──
  {
    id: "term-rj45-rj45",
    name: "RJ45 → RJ45",
    awg: "24",
    type: "Network",
    terminated: true,
    subcategory: "ethernet",
    defaultLength: "5 m",
    endA: { kind: "RJ45", gender: "male", pins: 8, label: "RJ45" },
    endB: { kind: "RJ45", gender: "male", pins: 8, label: "RJ45" },
    conductors: [
      { color: "OG", label: "1 TX+", pinA: "1", pinB: "1" },
      { color: "YE", label: "2 TX−", pinA: "2", pinB: "2" }, // WH/OG pair approx
      { color: "GN", label: "3 RX+", pinA: "3", pinB: "3" },
      { color: "BU", label: "4", pinA: "4", pinB: "4" },
      { color: "WH", label: "5", pinA: "5", pinB: "5" },
      { color: "TQ", label: "6 RX−", pinA: "6", pinB: "6" }, // WH/GN approx
      { color: "BN", label: "7", pinA: "7", pinB: "7" },
      { color: "GY", label: "8", pinA: "8", pinB: "8" },
    ],
  },
  {
    id: "term-rj45-rj45-cat6",
    name: "RJ45 → RJ45 Cat6",
    awg: "23",
    type: "Network",
    terminated: true,
    subcategory: "ethernet",
    defaultLength: "5 m",
    endA: { kind: "RJ45", gender: "male", pins: 8, label: "RJ45 Cat6" },
    endB: { kind: "RJ45", gender: "male", pins: 8, label: "RJ45 Cat6" },
    conductors: [
      { color: "OG", label: "1", pinA: "1", pinB: "1" },
      { color: "YE", label: "2", pinA: "2", pinB: "2" },
      { color: "GN", label: "3", pinA: "3", pinB: "3" },
      { color: "BU", label: "4", pinA: "4", pinB: "4" },
      { color: "WH", label: "5", pinA: "5", pinB: "5" },
      { color: "TQ", label: "6", pinA: "6", pinB: "6" },
      { color: "BN", label: "7", pinA: "7", pinB: "7" },
      { color: "GY", label: "8", pinA: "8", pinB: "8" },
    ],
  },
  {
    id: "term-m12-d-d",
    name: "M12-D → M12-D",
    awg: "24",
    type: "Network",
    terminated: true,
    subcategory: "ethernet",
    defaultLength: "5 m",
    endA: { kind: "M12-D", gender: "male", pins: 4, label: "M12-D M" },
    endB: { kind: "M12-D", gender: "male", pins: 4, label: "M12-D M" },
    conductors: [
      { color: "YE", label: "1 TX+", pinA: "1", pinB: "1" },
      { color: "WH", label: "2 RX+", pinA: "2", pinB: "2" },
      { color: "OG", label: "3 TX−", pinA: "3", pinB: "3" },
      { color: "BU", label: "4 RX−", pinA: "4", pinB: "4" },
    ],
  },
  {
    id: "term-m12-d-rj45",
    name: "M12-D → RJ45",
    awg: "24",
    type: "Network",
    terminated: true,
    subcategory: "ethernet",
    defaultLength: "5 m",
    endA: { kind: "M12-D", gender: "male", pins: 4, label: "M12-D M" },
    endB: { kind: "RJ45", gender: "male", pins: 8, label: "RJ45" },
    conductors: [
      { color: "YE", label: "TX+ / 1", pinA: "1", pinB: "1" },
      { color: "WH", label: "RX+ / 3", pinA: "2", pinB: "3" },
      { color: "OG", label: "TX− / 2", pinA: "3", pinB: "2" },
      { color: "BU", label: "RX− / 6", pinA: "4", pinB: "6" },
    ],
  },
  {
    id: "term-m12-x-x",
    name: "M12-X → M12-X",
    awg: "26",
    type: "Network",
    terminated: true,
    subcategory: "ethernet",
    defaultLength: "5 m",
    endA: { kind: "M12-X", gender: "male", pins: 8, label: "M12-X M" },
    endB: { kind: "M12-X", gender: "male", pins: 8, label: "M12-X M" },
    conductors: [
      // IEC 61076-2-109 X-coded Gigabit pairs
      { color: "WH", label: "1 BI_DA+", pinA: "1", pinB: "1" },
      { color: "OG", label: "2 BI_DA−", pinA: "2", pinB: "2" },
      { color: "WH", label: "3 BI_DB+", pinA: "3", pinB: "3" },
      { color: "GN", label: "4 BI_DB−", pinA: "4", pinB: "4" },
      { color: "WH", label: "5 BI_DD+", pinA: "5", pinB: "5" },
      { color: "BN", label: "6 BI_DD−", pinA: "6", pinB: "6" },
      { color: "WH", label: "7 BI_DC+", pinA: "7", pinB: "7" },
      { color: "BU", label: "8 BI_DC−", pinA: "8", pinB: "8" },
    ],
  },
  {
    id: "term-m12-x-rj45",
    name: "M12-X → RJ45",
    awg: "26",
    type: "Network",
    terminated: true,
    subcategory: "ethernet",
    defaultLength: "5 m",
    endA: { kind: "M12-X", gender: "male", pins: 8, label: "M12-X M" },
    endB: { kind: "RJ45", gender: "male", pins: 8, label: "RJ45" },
    conductors: [
      { color: "WH", label: "1 → 1", pinA: "1", pinB: "1" },
      { color: "OG", label: "2 → 2", pinA: "2", pinB: "2" },
      { color: "GN", label: "3 → 3", pinA: "3", pinB: "3" },
      { color: "BU", label: "4 → 4", pinA: "4", pinB: "4" },
      { color: "WH", label: "5 → 5", pinA: "5", pinB: "5" },
      { color: "TQ", label: "6 → 6", pinA: "6", pinB: "6" },
      { color: "BN", label: "7 → 7", pinA: "7", pinB: "7" },
      { color: "GY", label: "8 → 8", pinA: "8", pinB: "8" },
    ],
  },
  {
    id: "term-m12-x-f-m",
    name: "M12-X F → M12-X M",
    awg: "26",
    type: "Network",
    terminated: true,
    subcategory: "ethernet",
    defaultLength: "2 m",
    endA: { kind: "M12-X", gender: "female", pins: 8, label: "M12-X F" },
    endB: { kind: "M12-X", gender: "male", pins: 8, label: "M12-X M" },
    conductors: [
      { color: "WH", label: "1", pinA: "1", pinB: "1" },
      { color: "OG", label: "2", pinA: "2", pinB: "2" },
      { color: "GN", label: "3", pinA: "3", pinB: "3" },
      { color: "BU", label: "4", pinA: "4", pinB: "4" },
      { color: "YE", label: "5", pinA: "5", pinB: "5" },
      { color: "BN", label: "6", pinA: "6", pinB: "6" },
      { color: "TQ", label: "7", pinA: "7", pinB: "7" },
      { color: "GY", label: "8", pinA: "8", pinB: "8" },
    ],
  },
  {
    id: "term-m12-d-f-m",
    name: "M12-D F → M12-D M",
    awg: "24",
    type: "Network",
    terminated: true,
    subcategory: "ethernet",
    defaultLength: "2 m",
    endA: { kind: "M12-D", gender: "female", pins: 4, label: "M12-D F" },
    endB: { kind: "M12-D", gender: "male", pins: 4, label: "M12-D M" },
    conductors: [
      { color: "YE", label: "1 TX+", pinA: "1", pinB: "1" },
      { color: "WH", label: "2 RX+", pinA: "2", pinB: "2" },
      { color: "OG", label: "3 TX−", pinA: "3", pinB: "3" },
      { color: "BU", label: "4 RX−", pinA: "4", pinB: "4" },
    ],
  },
  {
    id: "term-m12-l-leads",
    name: "M12-L power → leads",
    awg: "16",
    type: "Power",
    terminated: true,
    subcategory: "power",
    defaultLength: "5 m",
    endA: { kind: "M12-L", gender: "female", pins: 5, label: "M12-L F" },
    endB: { kind: "flying-leads", gender: null, pins: 5, label: "Flying leads" },
    conductors: [
      { color: "BN", label: "L+", pinA: "1", pinB: "BN" },
      { color: "WH", label: "N / L−", pinA: "2", pinB: "WH" },
      { color: "GNYE", label: "PE", pinA: "3", pinB: "GNYE" },
      { color: "BK", label: "FE", pinA: "4", pinB: "BK" },
      { color: "GY", label: "Spare", pinA: "5", pinB: "GY" },
    ],
  },
  {
    id: "term-m12-4f-bulkhead",
    name: "M12-4F → bulkhead mate",
    awg: "22",
    type: "Sensor",
    terminated: true,
    subcategory: "panel",
    defaultLength: "0.5 m",
    endA: { kind: "M12-A", gender: "female", pins: 4, label: "M12-4F" },
    endB: { kind: "M12-bulkhead", gender: "male", pins: 4, label: "M12 bulkhead (field)" },
    conductors: [
      { color: "BN", label: "1 / +V", pinA: "1", pinB: "1" },
      { color: "WH", label: "2", pinA: "2", pinB: "2" },
      { color: "BU", label: "3 / 0V", pinA: "3", pinB: "3" },
      { color: "BK", label: "4 / OUT", pinA: "4", pinB: "4" },
    ],
  },
  {
    id: "term-m12-5f-bulkhead",
    name: "M12-5F → bulkhead mate",
    awg: "22",
    type: "Sensor",
    terminated: true,
    subcategory: "panel",
    defaultLength: "0.5 m",
    endA: { kind: "M12-A", gender: "female", pins: 5, label: "M12-5F" },
    endB: { kind: "M12-bulkhead", gender: "male", pins: 5, label: "M12-5 bulkhead" },
    conductors: [
      { color: "BN", label: "1", pinA: "1", pinB: "1" },
      { color: "WH", label: "2", pinA: "2", pinB: "2" },
      { color: "BU", label: "3", pinA: "3", pinB: "3" },
      { color: "BK", label: "4", pinA: "4", pinB: "4" },
      { color: "GY", label: "5", pinA: "5", pinB: "5" },
    ],
  },
  {
    id: "term-m12-d-bulkhead",
    name: "M12-D → bulkhead mate",
    awg: "24",
    type: "Network",
    terminated: true,
    subcategory: "panel",
    defaultLength: "0.5 m",
    endA: { kind: "M12-D", gender: "male", pins: 4, label: "M12-D M" },
    endB: { kind: "M12-D-bulkhead", gender: "female", pins: 4, label: "M12-D bulkhead" },
    conductors: [
      { color: "YE", label: "1 TX+", pinA: "1", pinB: "1" },
      { color: "WH", label: "2 RX+", pinA: "2", pinB: "2" },
      { color: "OG", label: "3 TX−", pinA: "3", pinB: "3" },
      { color: "BU", label: "4 RX−", pinA: "4", pinB: "4" },
    ],
  },
  {
    id: "term-m12-x-bulkhead",
    name: "M12-X → bulkhead mate",
    awg: "26",
    type: "Network",
    terminated: true,
    subcategory: "panel",
    defaultLength: "0.5 m",
    endA: { kind: "M12-X", gender: "male", pins: 8, label: "M12-X M" },
    endB: { kind: "M12-X-bulkhead", gender: "female", pins: 8, label: "M12-X bulkhead" },
    conductors: [
      { color: "WH", label: "1", pinA: "1", pinB: "1" },
      { color: "OG", label: "2", pinA: "2", pinB: "2" },
      { color: "GN", label: "3", pinA: "3", pinB: "3" },
      { color: "BU", label: "4", pinA: "4", pinB: "4" },
      { color: "YE", label: "5", pinA: "5", pinB: "5" },
      { color: "BN", label: "6", pinA: "6", pinB: "6" },
      { color: "TQ", label: "7", pinA: "7", pinB: "7" },
      { color: "GY", label: "8", pinA: "8", pinB: "8" },
    ],
  },
  {
    id: "term-valve-din-leads",
    name: "Valve DIN → leads",
    awg: "18",
    type: "Control",
    terminated: true,
    subcategory: "valve",
    defaultLength: "5 m",
    endA: { kind: "DIN43650-A", gender: "female", pins: 3, label: "DIN 43650-A" },
    endB: { kind: "flying-leads", gender: null, pins: 3, label: "Flying leads" },
    conductors: [
      { color: "BN", label: "1", pinA: "1", pinB: "BN" },
      { color: "BU", label: "2", pinA: "2", pinB: "BU" },
      { color: "GNYE", label: "PE", pinA: "PE", pinB: "GNYE" },
    ],
  },
];

export const templateById = (id) => CABLE_TEMPLATES.find((t) => t.id === id) || CABLE_TEMPLATES[0];

export function openCableTemplates() {
  return CABLE_TEMPLATES.filter((t) => !t.terminated);
}

export function terminatedCableTemplates() {
  return CABLE_TEMPLATES.filter((t) => t.terminated);
}


/** Ordered subcategories for terminated cordset palette */
export const TERMINATED_SUBCATEGORIES = [
  { id: "m12-sensor", label: "M12 sensor (4 / 5 pin)" },
  { id: "m12-multipin", label: "M12 multi-pin (8 / 12)" },
  { id: "ethernet", label: "Ethernet" },
  { id: "power", label: "Power" },
  { id: "panel", label: "Bulkhead / panel (place + mate)" },
  { id: "valve", label: "Valve / control" },
];

export function terminatedTemplatesBySubcategory() {
  const groups = TERMINATED_SUBCATEGORIES.map((g) => ({
    ...g,
    templates: CABLE_TEMPLATES.filter((t) => t.terminated && t.subcategory === g.id),
  }));
  const known = new Set(TERMINATED_SUBCATEGORIES.map((g) => g.id));
  const other = CABLE_TEMPLATES.filter((t) => t.terminated && !known.has(t.subcategory));
  if (other.length) {
    groups.push({ id: "other", label: "Other", templates: other });
  }
  return groups.filter((g) => g.templates.length);
}


export function endLabel(end) {
  if (!end) return "Open";
  return end.label || end.kind || "—";
}

/** Device / enclosure / terminal catalog */
export const COMPONENT_CATALOG = {
  devices: [
    {
      type: "plc",
      label: "PLC / CPU",
      tagPrefix: "PLC",
      width: 140,
      height: 100,
      category: "device",
      defaultTerminals: [
        { id: "L+", name: "+24V" },
        { id: "M", name: "0V" },
        { id: "PE", name: "PE" },
        { id: "DI0", name: "DI 0.0" },
        { id: "DI1", name: "DI 0.1" },
        { id: "DI2", name: "DI 0.2" },
        { id: "DI3", name: "DI 0.3" },
        { id: "DO0", name: "DO 0.0" },
        { id: "DO1", name: "DO 0.1" },
        { id: "COM", name: "COM" },
      ],
    },
    {
      type: "vfd",
      label: "VFD / Drive",
      tagPrefix: "VFD",
      width: 120,
      height: 110,
      category: "device",
      defaultTerminals: [
        { id: "L1", name: "L1" },
        { id: "L2", name: "L2" },
        { id: "L3", name: "L3" },
        { id: "PE", name: "PE" },
        { id: "U", name: "U / T1" },
        { id: "V", name: "V / T2" },
        { id: "W", name: "W / T3" },
        { id: "DI1", name: "DI1" },
        { id: "COM", name: "COM" },
        { id: "+24", name: "+24V" },
      ],
    },
    {
      type: "motor",
      label: "Motor",
      tagPrefix: "M",
      width: 100,
      height: 90,
      category: "device",
      defaultTerminals: [
        { id: "U1", name: "U1 / T1" },
        { id: "V1", name: "V1 / T2" },
        { id: "W1", name: "W1 / T3" },
        { id: "PE", name: "PE / GND" },
        { id: "TS+", name: "Therm + " },
        { id: "TS-", name: "Therm −" },
      ],
    },
    {
      type: "sensor",
      label: "Sensor",
      tagPrefix: "B",
      width: 90,
      height: 70,
      category: "device",
      defaultTerminals: [
        { id: "1", name: "BN +V" },
        { id: "2", name: "WH SIG" },
        { id: "3", name: "BU 0V" },
        { id: "4", name: "BK OUT" },
      ],
    },
    {
      type: "hmi",
      label: "HMI / Panel",
      tagPrefix: "HMI",
      width: 110,
      height: 80,
      category: "device",
      defaultTerminals: [
        { id: "L+", name: "+24V" },
        { id: "M", name: "0V" },
        { id: "PE", name: "PE" },
        { id: "TX+", name: "TX+" },
        { id: "TX-", name: "TX−" },
        { id: "RX+", name: "RX+" },
        { id: "RX-", name: "RX−" },
      ],
    },
    {
      type: "pushbutton",
      label: "Pushbutton",
      tagPrefix: "PB",
      width: 80,
      height: 70,
      category: "device",
      defaultTerminals: [
        { id: "NO1", name: "NO 1" },
        { id: "NO2", name: "NO 2" },
        { id: "NC1", name: "NC 1" },
        { id: "NC2", name: "NC 2" },
        { id: "LED+", name: "Lamp +" },
        { id: "LED-", name: "Lamp −" },
      ],
    },
    {
      type: "contactor",
      label: "Contactor",
      tagPrefix: "K",
      width: 100,
      height: 90,
      category: "device",
      defaultTerminals: [
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
      type: "psu",
      label: "Power supply",
      tagPrefix: "PS",
      width: 100,
      height: 80,
      category: "device",
      defaultTerminals: [
        { id: "L", name: "L / Hot" },
        { id: "N", name: "N" },
        { id: "PE", name: "PE" },
        { id: "+V", name: "+24V" },
        { id: "0V", name: "0V" },
        { id: "PE2", name: "PE DC" },
      ],
    },
  ],
  enclosures: [
    {
      type: "jbox",
      label: "Junction box",
      tagPrefix: "JB",
      width: 130,
      height: 100,
      category: "jbox",
      defaultTerminals: [
        { id: "1", name: "Term 1" },
        { id: "2", name: "Term 2" },
        { id: "3", name: "Term 3" },
        { id: "4", name: "Term 4" },
        { id: "5", name: "Term 5" },
        { id: "6", name: "Term 6" },
        { id: "7", name: "Term 7" },
        { id: "8", name: "Term 8" },
        { id: "PE", name: "PE bus" },
      ],
    },
    {
      type: "panel",
      label: "Control panel",
      tagPrefix: "CP",
      width: 160,
      height: 120,
      category: "jbox",
      defaultTerminals: [
        { id: "X1-1", name: "X1:1" },
        { id: "X1-2", name: "X1:2" },
        { id: "X1-3", name: "X1:3" },
        { id: "X1-4", name: "X1:4" },
        { id: "X1-5", name: "X1:5" },
        { id: "X1-6", name: "X1:6" },
        { id: "X2-1", name: "X2:1" },
        { id: "X2-2", name: "X2:2" },
        { id: "X2-3", name: "X2:3" },
        { id: "X2-4", name: "X2:4" },
        { id: "PE", name: "PE bar" },
      ],
    },
    {
      type: "pullbox",
      label: "Pull box",
      tagPrefix: "PBX",
      width: 100,
      height: 70,
      category: "jbox",
      defaultTerminals: [
        { id: "A1", name: "A in" },
        { id: "A2", name: "A out" },
        { id: "B1", name: "B in" },
        { id: "B2", name: "B out" },
        { id: "PE", name: "PE" },
      ],
    },
  ],
  terminals: [
    {
      type: "termstrip",
      label: "Terminal strip",
      tagPrefix: "XT",
      width: 160,
      height: 50,
      category: "terminal",
      defaultTerminals: [
        { id: "1", name: "1" },
        { id: "2", name: "2" },
        { id: "3", name: "3" },
        { id: "4", name: "4" },
        { id: "5", name: "5" },
        { id: "6", name: "6" },
        { id: "7", name: "7" },
        { id: "8", name: "8" },
        { id: "9", name: "9" },
        { id: "10", name: "10" },
        { id: "11", name: "11" },
        { id: "12", name: "12" },
      ],
    },
    {
      type: "dinrail",
      label: "DIN terminal",
      tagPrefix: "X",
      width: 120,
      height: 44,
      category: "terminal",
      defaultTerminals: [
        { id: "1", name: "1" },
        { id: "2", name: "2" },
        { id: "3", name: "3" },
        { id: "4", name: "4" },
        { id: "5", name: "5" },
        { id: "6", name: "6" },
        { id: "PE", name: "PE" },
      ],
    },
  ],
  /**
   * Bulkhead / panel mating connectors — place on canvas so terminated
   * cordsets can attach to Field (F*) and Panel (P*) landings.
   * mateFace: field gender the cordset plugs into (usually female on bulkhead).
   */
  connectors: [
    {
      type: "m12-4-bulkhead",
      label: "M12-4 bulkhead",
      tagPrefix: "X12",
      width: 110,
      height: 92,
      category: "connector",
      placeable: true,
      mateCoding: "M12-A",
      matePins: 4,
      mateFace: "female",
      defaultTerminals: [
        { id: "F1", name: "Field 1 BN +V", matePin: "1", side: "field" },
        { id: "F2", name: "Field 2 WH", matePin: "2", side: "field" },
        { id: "F3", name: "Field 3 BU 0V", matePin: "3", side: "field" },
        { id: "F4", name: "Field 4 BK OUT", matePin: "4", side: "field" },
        { id: "P1", name: "Panel 1 BN +V", matePin: "1", side: "panel" },
        { id: "P2", name: "Panel 2 WH", matePin: "2", side: "panel" },
        { id: "P3", name: "Panel 3 BU 0V", matePin: "3", side: "panel" },
        { id: "P4", name: "Panel 4 BK OUT", matePin: "4", side: "panel" },
        { id: "SH", name: "Shell / shield", matePin: "SH", side: "shell" },
      ],
    },
    {
      type: "m12-5-bulkhead",
      label: "M12-5 bulkhead",
      tagPrefix: "X12",
      width: 114,
      height: 100,
      category: "connector",
      placeable: true,
      mateCoding: "M12-A",
      matePins: 5,
      mateFace: "female",
      defaultTerminals: [
        { id: "F1", name: "Field 1 BN +V", matePin: "1", side: "field" },
        { id: "F2", name: "Field 2 WH", matePin: "2", side: "field" },
        { id: "F3", name: "Field 3 BU 0V", matePin: "3", side: "field" },
        { id: "F4", name: "Field 4 BK", matePin: "4", side: "field" },
        { id: "F5", name: "Field 5 GY", matePin: "5", side: "field" },
        { id: "P1", name: "Panel 1 BN +V", matePin: "1", side: "panel" },
        { id: "P2", name: "Panel 2 WH", matePin: "2", side: "panel" },
        { id: "P3", name: "Panel 3 BU 0V", matePin: "3", side: "panel" },
        { id: "P4", name: "Panel 4 BK", matePin: "4", side: "panel" },
        { id: "P5", name: "Panel 5 GY", matePin: "5", side: "panel" },
        { id: "SH", name: "Shell / shield", matePin: "SH", side: "shell" },
      ],
    },
    {
      type: "m12-8-bulkhead",
      label: "M12-8 bulkhead",
      tagPrefix: "X12",
      width: 124,
      height: 114,
      category: "connector",
      placeable: true,
      mateCoding: "M12-A",
      matePins: 8,
      mateFace: "female",
      defaultTerminals: [
        { id: "F1", name: "Field 1", matePin: "1", side: "field" },
        { id: "F2", name: "Field 2", matePin: "2", side: "field" },
        { id: "F3", name: "Field 3", matePin: "3", side: "field" },
        { id: "F4", name: "Field 4", matePin: "4", side: "field" },
        { id: "F5", name: "Field 5", matePin: "5", side: "field" },
        { id: "F6", name: "Field 6", matePin: "6", side: "field" },
        { id: "F7", name: "Field 7", matePin: "7", side: "field" },
        { id: "F8", name: "Field 8", matePin: "8", side: "field" },
        { id: "P1", name: "Panel 1", matePin: "1", side: "panel" },
        { id: "P2", name: "Panel 2", matePin: "2", side: "panel" },
        { id: "P3", name: "Panel 3", matePin: "3", side: "panel" },
        { id: "P4", name: "Panel 4", matePin: "4", side: "panel" },
        { id: "P5", name: "Panel 5", matePin: "5", side: "panel" },
        { id: "P6", name: "Panel 6", matePin: "6", side: "panel" },
        { id: "P7", name: "Panel 7", matePin: "7", side: "panel" },
        { id: "P8", name: "Panel 8", matePin: "8", side: "panel" },
        { id: "SH", name: "Shell / shield", matePin: "SH", side: "shell" },
      ],
    },
    {
      type: "m12-12-bulkhead",
      label: "M12-12 bulkhead",
      tagPrefix: "X12",
      width: 132,
      height: 128,
      category: "connector",
      placeable: true,
      mateCoding: "M12-A",
      matePins: 12,
      mateFace: "female",
      defaultTerminals: [
        ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => ({
          id: `F${n}`,
          name: `Field ${n}`,
          matePin: String(n),
          side: "field",
        })),
        ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => ({
          id: `P${n}`,
          name: `Panel ${n}`,
          matePin: String(n),
          side: "panel",
        })),
        { id: "SH", name: "Shell / shield", matePin: "SH", side: "shell" },
      ],
    },
    {
      type: "m12-d-bulkhead",
      label: "M12-D bulkhead",
      tagPrefix: "X12D",
      width: 110,
      height: 92,
      category: "connector",
      placeable: true,
      mateCoding: "M12-D",
      matePins: 4,
      mateFace: "female",
      defaultTerminals: [
        { id: "F1", name: "Field 1 TX+", matePin: "1", side: "field" },
        { id: "F2", name: "Field 2 RX+", matePin: "2", side: "field" },
        { id: "F3", name: "Field 3 TX−", matePin: "3", side: "field" },
        { id: "F4", name: "Field 4 RX−", matePin: "4", side: "field" },
        { id: "P1", name: "Panel 1 TX+", matePin: "1", side: "panel" },
        { id: "P2", name: "Panel 2 RX+", matePin: "2", side: "panel" },
        { id: "P3", name: "Panel 3 TX−", matePin: "3", side: "panel" },
        { id: "P4", name: "Panel 4 RX−", matePin: "4", side: "panel" },
        { id: "SH", name: "Shell / shield", matePin: "SH", side: "shell" },
      ],
    },
    {
      type: "m12-x-bulkhead",
      label: "M12-X bulkhead",
      tagPrefix: "X12X",
      width: 120,
      height: 110,
      category: "connector",
      placeable: true,
      mateCoding: "M12-X",
      matePins: 8,
      mateFace: "female",
      defaultTerminals: [
        { id: "F1", name: "Field 1 BI_DA+", matePin: "1", side: "field" },
        { id: "F2", name: "Field 2 BI_DA−", matePin: "2", side: "field" },
        { id: "F3", name: "Field 3 BI_DB+", matePin: "3", side: "field" },
        { id: "F4", name: "Field 4 BI_DB−", matePin: "4", side: "field" },
        { id: "F5", name: "Field 5 BI_DD+", matePin: "5", side: "field" },
        { id: "F6", name: "Field 6 BI_DD−", matePin: "6", side: "field" },
        { id: "F7", name: "Field 7 BI_DC+", matePin: "7", side: "field" },
        { id: "F8", name: "Field 8 BI_DC−", matePin: "8", side: "field" },
        { id: "P1", name: "Panel 1", matePin: "1", side: "panel" },
        { id: "P2", name: "Panel 2", matePin: "2", side: "panel" },
        { id: "P3", name: "Panel 3", matePin: "3", side: "panel" },
        { id: "P4", name: "Panel 4", matePin: "4", side: "panel" },
        { id: "P5", name: "Panel 5", matePin: "5", side: "panel" },
        { id: "P6", name: "Panel 6", matePin: "6", side: "panel" },
        { id: "P7", name: "Panel 7", matePin: "7", side: "panel" },
        { id: "P8", name: "Panel 8", matePin: "8", side: "panel" },
        { id: "SH", name: "Shell / shield", matePin: "SH", side: "shell" },
      ],
    },
    {
      type: "m12-power-bulkhead",
      label: "M12-L power BH",
      tagPrefix: "X12P",
      width: 114,
      height: 100,
      category: "connector",
      placeable: true,
      mateCoding: "M12-L",
      matePins: 5,
      mateFace: "female",
      defaultTerminals: [
        { id: "F1", name: "Field L+", matePin: "1", side: "field" },
        { id: "F2", name: "Field N / L−", matePin: "2", side: "field" },
        { id: "F3", name: "Field PE", matePin: "3", side: "field" },
        { id: "F4", name: "Field FE", matePin: "4", side: "field" },
        { id: "F5", name: "Field spare", matePin: "5", side: "field" },
        { id: "P1", name: "Panel L+", matePin: "1", side: "panel" },
        { id: "P2", name: "Panel N / L−", matePin: "2", side: "panel" },
        { id: "P3", name: "Panel PE", matePin: "3", side: "panel" },
        { id: "P4", name: "Panel FE", matePin: "4", side: "panel" },
        { id: "P5", name: "Panel spare", matePin: "5", side: "panel" },
        { id: "SH", name: "Shell / shield", matePin: "SH", side: "shell" },
      ],
    },
    {
      type: "rj45-panel",
      label: "RJ45 panel jack",
      tagPrefix: "XETH",
      width: 100,
      height: 88,
      category: "connector",
      placeable: true,
      mateCoding: "RJ45",
      matePins: 8,
      mateFace: "female",
      defaultTerminals: [
        { id: "F1", name: "Jack 1", matePin: "1", side: "field" },
        { id: "F2", name: "Jack 2", matePin: "2", side: "field" },
        { id: "F3", name: "Jack 3", matePin: "3", side: "field" },
        { id: "F4", name: "Jack 4", matePin: "4", side: "field" },
        { id: "F5", name: "Jack 5", matePin: "5", side: "field" },
        { id: "F6", name: "Jack 6", matePin: "6", side: "field" },
        { id: "F7", name: "Jack 7", matePin: "7", side: "field" },
        { id: "F8", name: "Jack 8", matePin: "8", side: "field" },
        { id: "P1", name: "Rear 1", matePin: "1", side: "panel" },
        { id: "P2", name: "Rear 2", matePin: "2", side: "panel" },
        { id: "P3", name: "Rear 3", matePin: "3", side: "panel" },
        { id: "P4", name: "Rear 4", matePin: "4", side: "panel" },
        { id: "P5", name: "Rear 5", matePin: "5", side: "panel" },
        { id: "P6", name: "Rear 6", matePin: "6", side: "panel" },
        { id: "P7", name: "Rear 7", matePin: "7", side: "panel" },
        { id: "P8", name: "Rear 8", matePin: "8", side: "panel" },
        { id: "SH", name: "Shell / shield", matePin: "SH", side: "shell" },
      ],
    },
  ],
};

/** Placeable bulkhead / panel mating connectors */
export function bulkheadCatalog() {
  return (COMPONENT_CATALOG.connectors || []).filter((c) => c.placeable !== false);
}

/** Resolve which mate side a landing ID belongs to */
export function mateSideFromTerminalId(terminalId) {
  const id = String(terminalId || "");
  if (/^F/i.test(id)) return "field";
  if (/^P/i.test(id)) return "panel";
  if (/^SH$/i.test(id) || /shell|shield/i.test(id)) return "shell";
  return "any";
}

/**
 * Find best terminal on a node for a cordset pin on a given side.
 * pin may be "1", "4", "BN", "PE", "SH", etc.
 */
export function resolveMateTerminal(node, pin, side = "field") {
  if (!node?.terminals?.length) return null;
  const p = String(pin || "").trim();
  if (!p) return null;

  const terms = node.terminals;
  const sideTerms =
    side === "field"
      ? terms.filter((t) => mateSideFromTerminalId(t.id) === "field")
      : side === "panel"
        ? terms.filter((t) => mateSideFromTerminalId(t.id) === "panel")
        : terms;

  // Direct ID match
  const direct = terms.find((t) => t.id === p || t.id.toUpperCase() === p.toUpperCase());
  if (direct) return direct.id;

  // F1 / P1 style from pin number
  if (side === "field" || side === "panel") {
    const pref = side === "field" ? "F" : "P";
    const keyed = terms.find((t) => t.id.toUpperCase() === `${pref}${p}`.toUpperCase());
    if (keyed) return keyed.id;
    // matePin metadata
    const byMate = sideTerms.find(
      (t) => String(t.matePin || "").toUpperCase() === p.toUpperCase()
    );
    if (byMate) return byMate.id;
  }

  // Color / label match on that side (flying leads)
  const byColor = sideTerms.find(
    (t) =>
      String(t.matePin || "").toUpperCase() === p.toUpperCase() ||
      String(t.name || "").toUpperCase().includes(p.toUpperCase()) ||
      String(t.id || "").toUpperCase() === p.toUpperCase()
  );
  if (byColor) return byColor.id;

  // Numeric index into side pins
  const n = parseInt(p, 10);
  if (!Number.isNaN(n) && n >= 1 && sideTerms[n - 1]) return sideTerms[n - 1].id;

  return null;
}

/**
 * Map terminated cable conductors onto bulkhead/device landings by pin / side.
 * Clicked terminal decides field vs panel vs generic sequential.
 */
export function mapCableLandingsToNodes(cable, fromNode, fromTerminalId, toNode, toTerminalId) {
  const fromSide = mateSideFromTerminalId(fromTerminalId);
  const toSide = mateSideFromTerminalId(toTerminalId);
  const fromIsBulkhead = fromNode?.category === "connector";
  const toIsBulkhead = toNode?.category === "connector";

  const fromTerms = fromNode?.terminals || [];
  const toTerms = toNode?.terminals || [];
  const fromIdx = fromTerms.findIndex((t) => t.id === fromTerminalId);
  const toIdx = toTerms.findIndex((t) => t.id === toTerminalId);

  (cable.conductors || []).forEach((cond, i) => {
    // From end
    if (fromIsBulkhead && (fromSide === "field" || fromSide === "panel")) {
      const pin = cond.pinA || String(i + 1);
      cond.fromTerminalId =
        resolveMateTerminal(fromNode, pin, fromSide) ||
        fromTerms[fromIdx + i]?.id ||
        fromTerminalId;
    } else if (fromIsBulkhead && fromSide === "shell") {
      cond.fromTerminalId = resolveMateTerminal(fromNode, "SH", "shell") || fromTerminalId;
    } else {
      cond.fromTerminalId =
        fromTerms[fromIdx + i]?.id || fromTerms[fromIdx]?.id || fromTerminalId;
    }

    // To end
    if (toIsBulkhead && (toSide === "field" || toSide === "panel")) {
      // Prefer pinB for cordset far end; for M12-M12 use pinB as pin numbers
      const pin = cond.pinB || cond.pinA || String(i + 1);
      cond.toTerminalId =
        resolveMateTerminal(toNode, pin, toSide) ||
        toTerms[toIdx + i]?.id ||
        toTerminalId;
    } else if (toIsBulkhead && toSide === "shell") {
      cond.toTerminalId = resolveMateTerminal(toNode, "SH", "shell") || toTerminalId;
    } else {
      // Flying leads / device pins: try pinB color or sequential
      const pin = cond.pinB || "";
      const byPin =
        pin && toNode
          ? resolveMateTerminal(toNode, pin, "any") ||
            toTerms.find((t) => t.id === pin)?.id
          : null;
      cond.toTerminalId =
        byPin || toTerms[toIdx + i]?.id || toTerms[toIdx]?.id || toTerminalId;
    }
  });

  cable.from.terminalId = fromTerminalId;
  cable.to.terminalId = toTerminalId;

  // Record mate metadata for BOM / landings
  if (fromIsBulkhead) {
    cable.from.mateSide = fromSide;
    cable.from.bulkheadTag = fromNode.tag;
  }
  if (toIsBulkhead) {
    cable.to.mateSide = toSide;
    cable.to.bulkheadTag = toNode.tag;
  }
}

export function findCatalogEntry(type) {
  for (const group of Object.values(COMPONENT_CATALOG)) {
    const found = group.find((c) => c.type === type);
    if (found) return found;
  }
  return null;
}

let _seq = 1;
export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${(_seq++).toString(36)}`;
}

export function nextTag(nodes, prefix) {
  const re = new RegExp(`^${prefix}(\\d+)$`, "i");
  let max = 0;
  for (const n of nodes) {
    const m = String(n.tag || "").match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${max + 1}`;
}

export function nextCableId(cables) {
  let max = 0;
  for (const c of cables) {
    const m = String(c.cableId || "").match(/^C(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `C${String(max + 1).padStart(3, "0")}`;
}

export function createEmptyProject(name = "Untitled Machine") {
  return {
    version: 1,
    id: uid("proj"),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: [],
    cables: [],
    view: { x: 0, y: 0, scale: 1 },
    meta: {
      drawingNumber: "WD-001",
      revision: "A",
      drawnBy: "",
      notes: "",
    },
  };
}

export function cloneTerminals(defs) {
  return defs.map((t) => ({
    id: t.id,
    name: t.name,
  }));
}

export function createNode(catalogType, x, y, existingNodes = []) {
  const cat = findCatalogEntry(catalogType);
  if (!cat) throw new Error(`Unknown component type: ${catalogType}`);
  const terminals = (cat.defaultTerminals || []).map((t) => ({
    id: t.id,
    name: t.name,
    matePin: t.matePin || "",
    side: t.side || "",
  }));
  return {
    id: uid("node"),
    type: cat.type,
    category: cat.category,
    tag: nextTag(existingNodes, cat.tagPrefix),
    name: cat.label,
    description: "",
    x: Math.round(x),
    y: Math.round(y),
    width: cat.width,
    height: cat.height,
    terminals,
    location: "",
    manufacturer: "",
    partNumber: "",
    // bulkhead / panel mating face metadata
    mateCoding: cat.mateCoding || "",
    matePins: cat.matePins || 0,
    mateFace: cat.mateFace || "",
    isBulkhead: cat.category === "connector",
  };
}

export function createCableFromTemplate(templateId, from, to, existingCables = []) {
  const tpl = templateById(templateId);
  const terminated = !!tpl.terminated;
  return {
    id: uid("cable"),
    cableId: nextCableId(existingCables),
    templateId: tpl.id,
    name: tpl.name,
    type: tpl.type,
    awg: tpl.awg,
    length: tpl.defaultLength || "",
    notes: "",
    partNumber: "",
    terminated,
    endA: terminated && tpl.endA ? { ...tpl.endA } : { kind: "open", gender: null, pins: null, label: "Open / bulk" },
    endB: terminated && tpl.endB ? { ...tpl.endB } : { kind: "open", gender: null, pins: null, label: "Open / bulk" },
    from: { nodeId: from.nodeId, terminalId: from.terminalId },
    to: { nodeId: to.nodeId, terminalId: to.terminalId },
    conductors: tpl.conductors.map((c, i) => ({
      index: i + 1,
      color: c.color,
      label: c.label,
      pinA: c.pinA || "",
      pinB: c.pinB || "",
      fromTerminalId: from.terminalId,
      toTerminalId: to.terminalId,
    })),
    route: null, // optional waypoints later
  };
}

export function landingRef(node, terminalId) {
  if (!node) return "—";
  const t = (node.terminals || []).find((x) => x.id === terminalId);
  const term = t ? t.id : terminalId;
  return `${node.tag}:${term}`;
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
