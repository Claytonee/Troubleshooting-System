/**
 * The OE explainer palette — frame.md (Blue Professional remixed onto the OE brand)
 * plus the app's own status colours from frontend/css/variables.css. Never invent a colour
 * in an episode: take it from here, by role.
 */
export const C = {
  bg: '#0f1117',        // ground
  surface: '#161921',   // device bodies (OE --bg2)
  well: '#0b0d12',      // screens, ports, recesses
  raised: '#232838',    // UI blocks, windows
  line: '#2a2f3d',      // dark LEDs, rules
  cable: '#4a5268',     // an unlit cable: must read against the ground at phone size (polish, 2026-09-26)
  primary: '#4f7cff',   // packets, live links, the accent
  primaryText: '#8aa6ff', // the accent as SMALL text: brand blue at micro-label size is under 4.5:1 on a device body
  text: '#e8eaf0',
  muted: '#9ba1b5',     // device strokes, sublabels
  faint: '#636a82',
  pos: '#2dd98a',       // healthy, ticks
  neg: '#ff5263',       // faults, breaks
  warn: '#f5a623',      // warnings, in-progress, current flow
  gold: '#FFAE00',      // the brand: once, as a rule over the lesson line
};

/** Canvas point the camera centres on: above the caption band (bottom ~17%). */
export const CAM = { cx: 960, cy: 440 };
