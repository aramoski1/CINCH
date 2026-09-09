import { color, type as typeface } from "@cinch/ui";
import type { CSSProperties } from "react";

export const shell: CSSProperties = {
  minHeight: "100vh",
  background: color.ink,
  color: color.paper,
  display: "flex",
  justifyContent: "center",
};

export const frame: CSSProperties = {
  width: "min(440px, 100%)",
  minHeight: "100vh",
  padding: "28px 20px 96px",
  position: "relative",
};

export const kicker: CSSProperties = {
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  fontSize: 12,
  margin: 0,
};

export const display: CSSProperties = {
  fontFamily: typeface.display,
  fontWeight: 400,
  fontSize: 32,
  lineHeight: 1.2,
  margin: "12px 0 24px",
};

export const field: CSSProperties = {
  width: "100%",
  background: "transparent",
  color: color.paper,
  border: "none",
  borderBottom: `1px solid ${color.paper}`,
  fontSize: 18,
  padding: "12px 0",
  outline: "none",
};

export const area: CSSProperties = {
  width: "100%",
  minHeight: 120,
  background: "transparent",
  color: color.paper,
  border: `1px solid ${color.paper}`,
  fontSize: 18,
  padding: 12,
  outline: "none",
  resize: "vertical",
};

export const ghostBtn: CSSProperties = {
  display: "inline-block",
  marginTop: 24,
  border: `1px solid ${color.paper}`,
  background: "transparent",
  color: color.paper,
  padding: "12px 16px",
  letterSpacing: "0.04em",
};

export const solidBtn: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 20,
  border: "none",
  background: color.paper,
  color: color.ink,
  padding: 14,
  letterSpacing: "0.04em",
  textAlign: "center",
  textDecoration: "none",
};

export const err: CSSProperties = {
  color: color.sealRed,
  marginTop: 12,
};

export const card: CSSProperties = {
  background: color.paper,
  color: color.ink,
  padding: 20,
  minHeight: 160,
};

export const nav: CSSProperties = {
  position: "fixed",
  left: "50%",
  bottom: 0,
  transform: "translateX(-50%)",
  width: "min(440px, 100%)",
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  background: color.ink,
  borderTop: "1px solid rgba(247,245,240,0.12)",
};

export const navBtn = (active: boolean): CSSProperties => ({
  background: "transparent",
  border: "none",
  color: active ? color.paper : "#8a877c",
  padding: "16px 0 20px",
  fontSize: 12,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
});
