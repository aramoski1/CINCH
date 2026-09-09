"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuthSession, CommitmentRow, GroupRow, Wallet } from "@cinch/api-client";
import { color } from "@cinch/ui";
import { createBrowserApi } from "../../lib/api";
import { clearSession, loadSession, saveSession } from "../../lib/session";
import * as ui from "./styles";

type Tab = "home" | "feed" | "create" | "groups" | "profile";

function inviteCodeFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("invite");
}

export function CinchApp() {
  const api = useMemo(() => createBrowserApi(), []);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    setSession(loadSession());
    setInviteCode(inviteCodeFromLocation());
  }, []);

  function signedIn(next: AuthSession) {
    saveSession(next);
    setSession(next);
  }

  function signOut() {
    clearSession();
    setSession(null);
    setTab("home");
  }

  if (!session) {
    return (
      <div style={ui.shell}>
        <div style={ui.frame}>
          <AuthScreen
            onSession={signedIn}
            inviteCode={inviteCode}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={ui.shell}>
      <div style={ui.frame}>
        {tab === "home" ? (
          <HomeScreen api={api} session={session} inviteCode={inviteCode} onCreate={() => setTab("create")} />
        ) : null}
        {tab === "feed" ? <FeedScreen api={api} /> : null}
        {tab === "create" ? <CreateScreen api={api} onLocked={() => setTab("home")} /> : null}
        {tab === "groups" ? <GroupsScreen api={api} /> : null}
        {tab === "profile" ? <ProfileScreen api={api} session={session} onSignOut={signOut} /> : null}
        <nav style={ui.nav} aria-label="Main">
          {(["home", "feed", "create", "groups", "profile"] as const).map((name) => (
            <button key={name} type="button" style={ui.navBtn(tab === name)} onClick={() => setTab(name)}>
              {name}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function AuthScreen({
  onSession,
  inviteCode,
}: {
  onSession: (session: AuthSession) => void;
  inviteCode: string | null;
}) {
  const api = useMemo(() => createBrowserApi(), []);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [stage, setStage] = useState<"email" | "otp">("email");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    setErr("");
    setBusy(true);
    try {
      const res = await api.requestEmailCode(email);
      if (res.throttled) {
        setErr("Wait a minute, then try again.");
        return;
      }
      setDevCode(res.devCode ?? null);
      setStage("otp");
    } catch {
      setErr("Could not send the code. Is the API running on port 4000?");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setErr("");
    setBusy(true);
    try {
      const session = await api.verifyEmail({
        email,
        code,
        displayName: name || undefined,
      });
      onSession(session);
    } catch {
      setErr("That code did not match.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <p style={ui.kicker}>Cinch</p>
      {stage === "email" ? (
        <>
          <h1 style={ui.display}>Your email. A six-digit code. That’s it.</h1>
          {inviteCode ? (
            <p style={{ opacity: 0.75 }}>
              Someone sent you a card ({inviteCode}). Sign in to hold them to it.
            </p>
          ) : null}
          <input
            autoComplete="email"
            inputMode="email"
            placeholder="you@babson.edu"
            style={ui.field}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {err ? <p style={ui.err}>{err}</p> : null}
          <button type="button" style={ui.ghostBtn} disabled={busy || !email.includes("@")} onClick={() => void sendCode()}>
            Send the code
          </button>
        </>
      ) : (
        <>
          <h1 style={ui.display}>Six digits.</h1>
          {devCode ? (
            <p style={{ color: color.signalAmber, fontVariantNumeric: "tabular-nums", fontSize: 28 }}>
              Local code: {devCode}
            </p>
          ) : (
            <p style={{ opacity: 0.75 }}>Check your email for the code.</p>
          )}
          <input
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            style={ui.field}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <input
            placeholder="What should we call you?"
            style={{ ...ui.field, marginTop: 16 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {err ? <p style={ui.err}>{err}</p> : null}
          <button type="button" style={ui.ghostBtn} disabled={busy || code.length !== 6} onClick={() => void verify()}>
            Continue
          </button>
        </>
      )}
    </section>
  );
}

function HomeScreen({
  api,
  session,
  inviteCode,
  onCreate,
}: {
  api: ReturnType<typeof createBrowserApi>;
  session: AuthSession;
  inviteCode: string | null;
  onCreate: () => void;
}) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [active, setActive] = useState<CommitmentRow[]>([]);
  const [inviteNote, setInviteNote] = useState("");
  const [err, setErr] = useState("");

  async function refresh() {
    try {
      const [me, rows] = await Promise.all([api.me(), api.activeCommitments()]);
      setWallet(me.wallet);
      setActive(rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load home.");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!inviteCode) return;
    void (async () => {
      try {
        const preview = await api.invitePreview(inviteCode);
        await api.accept(preview.id);
        setInviteNote(`You’re on ${preview.title}.`);
        await refresh();
      } catch {
        setInviteNote("That invite is waiting. Open it again after they lock the card.");
      }
    })();
  }, [inviteCode]);

  const next = active[0];
  const atStake = wallet?.reserved.minor ?? 0;

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 18 }}>{session.user.displayName}</p>
        <p style={{ margin: 0, fontVariantNumeric: "tabular-nums" }}>{session.user.score}</p>
      </div>
      <p style={{ color: color.signalAmber, marginTop: 4 }}>{session.user.streak} day streak</p>
      <p style={{ fontSize: 40, fontVariantNumeric: "tabular-nums", margin: "24px 0" }}>
        {atStake.toLocaleString()} pts at stake
      </p>
      {inviteNote ? <p style={{ color: color.signalAmber }}>{inviteNote}</p> : null}
      <article style={ui.card}>
        <p style={{ letterSpacing: "0.2em", fontSize: 11, margin: 0 }}>NEXT UP</p>
        <h2 style={{ fontFamily: "Iowan Old Style, Palatino, serif", fontWeight: 400, fontSize: 24 }}>
          {next?.spec.title ?? "Nothing locked yet."}
        </h2>
        <p style={{ fontSize: 36, fontVariantNumeric: "tabular-nums", margin: "8px 0" }}>
          {next ? next.spec.stake.amount.minor.toLocaleString() : "—"}
        </p>
        <p style={{ opacity: 0.7, margin: 0 }}>
          {next ? next.state.replaceAll("_", " ") : "A sealed card will live here."}
        </p>
      </article>
      {err ? <p style={ui.err}>{err}</p> : null}
      <button type="button" style={ui.ghostBtn} onClick={onCreate}>
        What are you committing to?
      </button>
    </section>
  );
}

function CreateScreen({
  api,
  onLocked,
}: {
  api: ReturnType<typeof createBrowserApi>;
  onLocked: () => void;
}) {
  const [utterance, setUtterance] = useState("");
  const [rendered, setRendered] = useState("");
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [spec, setSpec] = useState<unknown>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function parse() {
    setErr("");
    setBusy(true);
    setShareUrl("");
    try {
      const body = await api.parse(utterance);
      if ("blocked" in body && body.blocked) {
        setSpec(null);
        setRendered("");
        setAssumptions([]);
        setErr(body.message);
        return;
      }
      if (!("spec" in body) || !body.spec) {
        setErr("message" in body && body.message ? body.message : "Could not parse that.");
        return;
      }
      setSpec(body.spec);
      setRendered(body.rendered);
      setAssumptions(body.assumptions ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Parse failed.");
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    if (!spec) return;
    setErr("");
    setBusy(true);
    try {
      const created = await api.createCommitment(spec);
      const invited = await api.invite(created.id);
      await api.fund(created.id);
      setShareUrl(invited.shareUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not lock the card.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1 style={ui.display}>Say it once.</h1>
      <textarea
        placeholder="Gym by 6:30 tomorrow or I owe Ryan 2500 points"
        style={ui.area}
        value={utterance}
        onChange={(e) => setUtterance(e.target.value)}
      />
      <button type="button" style={ui.ghostBtn} disabled={busy || utterance.trim().length < 8} onClick={() => void parse()}>
        Parse
      </button>
      {rendered ? (
        <article style={{ ...ui.card, marginTop: 24 }}>
          <p style={{ letterSpacing: "0.2em", fontSize: 11, margin: 0 }}>THE CARD</p>
          <h2 style={{ fontFamily: "Iowan Old Style, Palatino, serif", fontWeight: 400 }}>{rendered}</h2>
          {assumptions.map((a) => (
            <p key={a} style={{ color: "#8a5a00", margin: "8px 0 0" }}>
              I assumed: {a}
            </p>
          ))}
          <button type="button" style={{ ...ui.solidBtn, marginTop: 16 }} disabled={busy} onClick={() => void lock()}>
            Lock it
          </button>
        </article>
      ) : null}
      {shareUrl ? (
        <p style={{ marginTop: 20 }}>
          Locked. Share this:{" "}
          <a href={shareUrl} style={{ color: color.paper }}>
            {shareUrl}
          </a>
          <button type="button" style={{ ...ui.ghostBtn, marginLeft: 12 }} onClick={onLocked}>
            Back home
          </button>
        </p>
      ) : null}
      {err ? <p style={ui.err}>{err}</p> : null}
    </section>
  );
}

function FeedScreen({ api }: { api: ReturnType<typeof createBrowserApi> }) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    void api
      .feed()
      .then(setItems)
      .catch((e) => setErr(e instanceof Error ? e.message : "Feed failed."));
  }, [api]);

  if (err) return <p style={ui.err}>{err}</p>;
  if (items.length === 0) {
    return <p style={{ fontSize: 20, lineHeight: 1.4 }}>When a friend locks something, it lands here.</p>;
  }

  return (
    <section>
      <p style={ui.kicker}>Feed</p>
      <h1 style={ui.display}>What’s locked.</h1>
      {items.map((item, i) => (
        <article key={String(item.id ?? i)} style={{ ...ui.card, marginBottom: 12 }}>
          <p style={{ letterSpacing: "0.16em", fontSize: 11, margin: 0 }}>{String(item.type ?? "update")}</p>
          <p style={{ fontSize: 20, margin: "8px 0 0" }}>{String(item.title ?? item.actor ?? item.id ?? "Update")}</p>
        </article>
      ))}
    </section>
  );
}

function GroupsScreen({ api }: { api: ReturnType<typeof createBrowserApi> }) {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  async function refresh() {
    setGroups(await api.groups());
  }

  useEffect(() => {
    void refresh().catch((e) => setErr(e instanceof Error ? e.message : "Groups failed."));
  }, []);

  async function create() {
    setErr("");
    try {
      await api.createGroup(name);
      setName("");
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create the group.");
    }
  }

  return (
    <section>
      <h1 style={ui.display}>Groups of 3–8.</h1>
      <p style={{ opacity: 0.75 }}>Forfeits go to charity, never the pot.</p>
      <input placeholder="Studio crew" style={ui.field} value={name} onChange={(e) => setName(e.target.value)} />
      <button type="button" style={ui.ghostBtn} disabled={!name.trim()} onClick={() => void create()}>
        Start a group
      </button>
      {groups.map((g) => (
        <article key={g.id} style={{ ...ui.card, marginTop: 16 }}>
          <p style={{ fontSize: 20, margin: 0 }}>{g.name}</p>
          <p style={{ opacity: 0.7, margin: "8px 0 0" }}>{g.memberIds.length} member{g.memberIds.length === 1 ? "" : "s"}</p>
        </article>
      ))}
      {err ? <p style={ui.err}>{err}</p> : null}
    </section>
  );
}

function ProfileScreen({
  api,
  session,
  onSignOut,
}: {
  api: ReturnType<typeof createBrowserApi>;
  session: AuthSession;
  onSignOut: () => void;
}) {
  const [name, setName] = useState(session.user.displayName);
  const [friend, setFriend] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    try {
      await api.updateMe({ displayName: name });
      const current = loadSession();
      if (current) saveSession({ ...current, user: { ...current.user, displayName: name } });
      setNote("Saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    }
  }

  async function addFriend() {
    setErr("");
    try {
      await api.addFriend(friend);
      setFriend("");
      setNote("Friend added.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No user with that email yet.");
    }
  }

  return (
    <section>
      <p style={{ fontSize: 64, fontVariantNumeric: "tabular-nums", margin: 0 }}>{session.user.score}</p>
      <p style={{ marginTop: 0 }}>Accountability score</p>
      <p style={{ opacity: 0.7 }}>{session.user.email}</p>
      <input style={ui.field} value={name} onChange={(e) => setName(e.target.value)} />
      <button type="button" style={ui.ghostBtn} onClick={() => void save()}>
        Update name
      </button>
      <h2 style={{ ...ui.display, fontSize: 24, marginTop: 40 }}>Add a friend</h2>
      <input
        placeholder="friend@babson.edu"
        style={ui.field}
        value={friend}
        onChange={(e) => setFriend(e.target.value)}
      />
      <button type="button" style={ui.ghostBtn} disabled={!friend.includes("@")} onClick={() => void addFriend()}>
        Add
      </button>
      {note ? <p style={{ color: color.signalAmber }}>{note}</p> : null}
      {err ? <p style={ui.err}>{err}</p> : null}
      <button type="button" style={{ ...ui.ghostBtn, display: "block" }} onClick={onSignOut}>
        Sign out
      </button>
      <a href="/ops" style={{ ...ui.ghostBtn, marginTop: 32, textDecoration: "none" }}>
        Ops console
      </a>
    </section>
  );
}
