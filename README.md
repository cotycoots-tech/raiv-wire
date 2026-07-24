# RAIV Wire

**Machine builder wiring diagram tool** — place devices, junction boxes, and terminal strips; draw multi-conductor cables with industrial wire colors; document terminal landings and export wire lists.

Built as a full client-side stack: **HTML · CSS · JavaScript** (ES modules). No build step required.

## Quick start

Open `index.html` in a modern browser, **or** serve the folder (recommended so modules load cleanly):

```bash
# from this directory
python3 -m http.server 8080
# then open http://localhost:8080
```

## Features

| Area | What you get |
|------|----------------|
| **Device catalog** | Reusable inventory (mfr, P/N, terminals). Place, save from Properties; import/export **Excel (.xlsx)**, CSV, or JSON |
| **Devices (generic)** | Blank templates: PLC, VFD, motor, sensor, HMI, pushbutton, contactor, PSU |
| **Enclosures** | Junction box, control panel, pull box |
| **Terminals** | Terminal strip, DIN rail terminals |
| **Bulkhead / panel** | Placeable mating connectors (M12-4/5/8/12, D, X, L, RJ45). Drag onto canvas; Field (F) + Panel (P) landings for terminated cordsets |
| **Cables (open)** | Multi-conductor bulk wire (power, control, signal, sensor, shielded pair) |
| **Cables (terminated)** | Cordsets in subcategories: M12 sensor, M12 multi-pin, Ethernet, Power, Bulkhead, Valve |
| **Wire colors** | Industrial palette (BK, RD, BU, WH, GNYE PE, BN, GY, OG, YE, VT, …) |
| **Landings** | Per-terminal IDs/names on every node; bottom landing map shows occupancy |
| **Wire list** | Live table + CSV export |
| **Project** | Auto-save (localStorage), JSON import/export, print/PDF |

## How to use

1. **Place components** — click a type in the left palette, then click the canvas.
2. **Select / move** — Select tool (V); drag nodes to reposition.
3. **Draw a cable** — pick a cable template (or Cable tool **C**), click a **from** terminal pin, then a **to** pin.
4. **Edit landings** — select a node; edit tag, location, manufacturer, and terminal IDs/names in Properties.
5. **Edit conductors** — select a cable; set AWG, length, per-conductor color, labels, and from/to terminals.
6. **Export** — JSON for the full project, CSV for the wire/cable list, Print for drawing output.

### Keyboard

| Key | Action |
|-----|--------|
| `V` | Select |
| `H` | Pan |
| `C` | Cable |
| `Space` (hold) | Temporary pan |
| `Delete` | Delete selection |
| `Ctrl/Cmd+Z` | Undo |
| `Ctrl/Cmd+Y` | Redo |
| `Esc` | Cancel place/cable |

### Tips

- **Shift+click** a terminal to start a cable from that landing.
- Scroll wheel zooms toward the cursor; **Fit** frames all components.
- PE / green-yellow is included on power and control templates for machine grounding practice.
- Demo project loads on first run (PLC, PSU, JB, sensor, VFD, motor + sample cables).

## Project structure

```
raiv-wire/
├── index.html          # App shell
├── css/styles.css      # Industrial UI + print styles
├── js/
│   ├── app.js          # UI, state, import/export, demo
│   ├── canvas.js       # SVG render, hit-test, viewport
│   ├── catalog.js      # Device inventory catalog (localStorage)
│   └── data.js         # Colors, component types, project model
└── README.md
```

## Data model (JSON)

```json
{
  "version": 1,
  "name": "My Machine",
  "nodes": [
    {
      "id": "node_…",
      "type": "plc",
      "category": "device",
      "tag": "PLC1",
      "terminals": [{ "id": "DI0", "name": "DI 0.0" }],
      "x": 80, "y": 120, "width": 140, "height": 100
    }
  ],
  "cables": [
    {
      "cableId": "C001",
      "awg": "18",
      "from": { "nodeId": "…", "terminalId": "+V" },
      "to": { "nodeId": "…", "terminalId": "L+" },
      "conductors": [
        { "index": 1, "color": "RD", "label": "+24V", "fromTerminalId": "+V", "toTerminalId": "L+" }
      ]
    }
  ],
  "view": { "x": 0, "y": 0, "scale": 1 }
}
```

## License

Internal engineering tool — adapt freely for your machine-builder workflows.
