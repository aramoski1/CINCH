import { color } from "@cinch/ui";

async function loadInvite(code: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
  try {
    const res = await fetch(`${base}/v1/invites/${code}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as {
      id: string;
      title: string;
      rendered: string;
      stake: { currency: string; minor: number };
      assumptions: string[];
    };
  } catch {
    return null;
  }
}

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = await loadInvite(code);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: color.ink,
        color: color.paper,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
      }}
    >
      <article
        style={{
          width: "min(440px, 100%)",
          background: color.paper,
          color: color.ink,
          padding: 32,
          boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 11px, rgba(10,10,11,0.03) 12px)",
        }}
      >
        <p style={{ letterSpacing: "0.18em", fontSize: 11, textTransform: "uppercase" }}>Cinch</p>
        <h1 style={{ fontFamily: "Iowan Old Style, Palatino, serif", fontWeight: 400, fontSize: 32 }}>
          {invite?.title ?? "A friend is committing to something."}
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.5 }}>{invite?.rendered ?? "Open this again once the API is running."}</p>
        <p
          style={{
            fontVariantNumeric: "tabular-nums",
            fontSize: 40,
            margin: "24px 0 8px",
            color: color.sealRed,
          }}
        >
          {invite ? `${invite.stake.minor.toLocaleString()} ${invite.stake.currency}` : "— pts"}
        </p>
        <p style={{ fontSize: 13, opacity: 0.7 }}>
          {(invite?.assumptions ?? []).join(" · ") || "Full terms visible. No signup gate."}
        </p>
        <a
          href={`/?invite=${code}`}
          style={{
            display: "block",
            marginTop: 28,
            textAlign: "center",
            background: color.ink,
            color: color.paper,
            padding: 14,
            textDecoration: "none",
            letterSpacing: "0.04em",
          }}
        >
          Hold them to it
        </a>
        <a
          href={`cinch://invite/${code}`}
          style={{
            display: "block",
            marginTop: 12,
            textAlign: "center",
            color: color.ink,
            opacity: 0.55,
            fontSize: 13,
          }}
        >
          Open in the iOS app
        </a>
      </article>
    </main>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = await loadInvite(code);
  return {
    title: invite?.title ?? "Cinch invite",
    description: invite?.rendered ?? "Someone wants you to hold them to it.",
    openGraph: { title: invite?.title ?? "Cinch", description: invite?.rendered ?? "" },
  };
}
