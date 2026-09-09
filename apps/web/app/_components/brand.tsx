export function Mark({ size = 56, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <img
      src="/cinch-mark.svg"
      alt=""
      width={size}
      height={size}
      className={glow ? "mark glow" : "mark"}
    />
  );
}

export function Wordmark({ size = 44 }: { size?: number }) {
  return (
    <div className="wordmark">
      <Mark size={size} />
      <span>
        <span className="brand-name">Cinch</span>
        <span className="brand-caption">keep your word</span>
      </span>
    </div>
  );
}

export function hue(name: string): number {
  let n = 0;
  for (const c of name) n = (n + c.charCodeAt(0) * 19) % 360;
  return n;
}

export function face(name: string): string {
  return `hsl(${hue(name)} 14% 26%)`;
}
