# Raiv-T3

Cell: **RAIV-T3**  
Controller: **F-24-0064095-C-002** (Stäubli CS9)  
App: **PlateSorter** (`autoStart`)  
EtherCAT: J206 3-slice D24403  
Live UI: https://cotycoots-tech.github.io/raiv-wire/

Project id in the library: `proj_raiv_t3_001`  
Active project file: `data/active-project.json`

## Load in the UI

1. Open https://cotycoots-tech.github.io/raiv-wire/
2. **GitHub → Pull** (owner `cotycoots-tech`, repo `raiv-wire`, branch `main`)
3. Select **Raiv-T3** in the project dropdown
4. **Fit** the canvas

If Pull is not configured, **Import** `data/active-project.json` → use the inner `project` object, or import the `projects.proj_raiv_t3_001` object from `data/projects-library.json`.

## Jackets

| ID | Type | From | To | Notes |
|---|---|---|---|---|
| C-10 | 25c fly-lead | EtherCAT T1–T3 | JB-02 Stand-01 | **Only** 25c homerun |
| C-11 | R23-19 | JB-02 | JB-03 forearm / J4 | Through-arm dress — **not** a second 25c |
| C-12 | M12-8 | J4 | EAOT-01-EMH84 logic | P-01 White = Mag, P-02 Brown = Demag |
| C-13 | M12-4 | J4 | EAOT-01-EMH84 power | P1/P4 +24, P2/P3 0V |
| C-14 | M12-5 | PBS-03 Servo-01 | JB-03-HMI-02 | Was C-12 — confirm still present |
| C-15 | M12-5 | PBS-04 Servo-02 | FD-06 Strobe-01 | Was C-13 — confirm still present |
| C-01 | M12-12 | JB-02 | PBS-01 Maintenance | HOLD pin detail |
| C-02 | M12-12 | JB-02 | PBS-02 Operation | HOLD pin detail |
| C-03 | M12-8 | JB-02 | PBS-03 Servo-01 | Field-walked |
| C-04 | M12-8 | JB-02 | PBS-04 Servo-02 | Field-walked |
| C-05 | M12-5 52 V | JB-02 | FD-01 switch | HOLD |
| C-06 | M12-5 | JB-02 | FD-02 door | Continues on C-10 P-04 |
| C-07 | M12-5 | JB-02 | FD-03 air | HOLD |
| C-08 | M12-5 | JB-02 | FD-04 hitch | HOLD |
| C-09 | M12-5 | JB-02 | FD-05 belt solenoid | Shared T2 Q5 |

Forearm jumpers on the canvas (`JMP-MAG`, `JMP-DEM`, `JMP-24`, `JMP-0V`) are internal JB-03 → J4 bulkhead landings, not field jackets.

## Mag / Demag (field-true)

C-10 P-06 Light Brown Mag → TB10-5 → C-11 P-09 + P-13 → C-12 P-01 White  
C-10 P-05 Violet Demag → TB10-6 → C-11 P-08 + P-14 → C-12 P-02 Brown

Old J4 book put Mag on R23-15 White and Demag on R23-16 Yellow. Those pins are HOLD until buzzed.

## VAL3 notes

- T3 Q0–Q3 use T2 safety-stop names: `doSafteyStop.None / Waiting / SS1 / SS2`. No C-10 home.
- Shared bits: Belt FWD lamp/solenoid (T2 Q5), Arm-isPowered / Warmup (T1 Q0).
- EMH status returns (old J4 P-04…P-08) have no C-10 home.

## Continuity still on machine

Buzz C-10 → C-11 → C-12 Mag/Demag end-to-end, jacket A-B, and isolation. Confirm C-14 / C-15 jackets are still dressed.
