/** Institutional Warmth — PRD §18.1 */
export const color = {
  ink: "#0A0A0B",
  inkMuted: "#2A2A2E",
  paper: "#F7F5F0",
  paperGrain: "#EFECE4",
  sealRed: "#D93F2B",
  verifiedStart: "#0F9D58",
  verifiedEnd: "#00C853",
  signalAmber: "#FFB300",
  line: "rgba(247, 245, 240, 0.12)",
} as const;

export const type = {
  display: '"Iowan Old Style", "Palatino Linotype", Palatino, serif',
  body: 'Inter, "Segoe UI", system-ui, sans-serif',
  numerals: '"Tabular nums", Inter, ui-sans-serif, sans-serif',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  hero: 48,
} as const;

export const radius = {
  card: 4,
  chip: 999,
} as const;
