import { color } from "@cinch/ui";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 48,
        background: color.ink,
        color: color.paper,
      }}
    >
      <p style={{ letterSpacing: "0.2em", textTransform: "uppercase", fontSize: 12 }}>
        Cinch
      </p>
      <h1 style={{ fontFamily: "Iowan Old Style, Palatino, serif", fontWeight: 400 }}>
        A signed card. A friend. Points on the line.
      </h1>
    </main>
  );
}
