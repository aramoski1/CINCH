"use client";

import { useEffect, useState } from "react";
import type { AuthSession, FriendsList, UserSettings } from "@cinch/api-client";
import { DEFAULT_SETTINGS } from "@cinch/api-client";
import { createBrowserApi } from "../../lib/api";
import { persistHaptics } from "../../lib/prefs";
import { formatStake, initials } from "../../lib/format";
import { Back, Cell, Confirm, Group, Switch } from "./ui";

export type SettingsPane =
  | "root"
  | "account"
  | "notifications"
  | "friends"
  | "privacy"
  | "safety"
  | "how"
  | "about"
  | "history";

export function SettingsStack({
  api,
  session,
  pane,
  onPane,
  onSignOut,
  onUser,
  onFlash,
}: {
  api: ReturnType<typeof createBrowserApi>;
  session: AuthSession;
  pane: SettingsPane;
  onPane: (pane: SettingsPane) => void;
  onSignOut: () => void;
  onUser: (next: AuthSession["user"]) => void;
  onFlash: (label: string) => void;
}) {
  const [me, setMe] = useState(session.user);
  const [wallet, setWallet] = useState<{ available: { minor: number }; reserved: { minor: number } } | null>(null);
  const [settings, setSettings] = useState<UserSettings>(session.user.settings ?? DEFAULT_SETTINGS);
  const [friends, setFriends] = useState<FriendsList>({ people: [], named: [] });
  const [ledger, setLedger] = useState<Array<{ id: string; title: string; outcome: string; stake: { minor: number } | null }>>([]);
  const [year, setYear] = useState<{ kept: number; broken: number; voided: number } | null>(null);
  const [notes, setNotes] = useState<Array<{ id?: string; template?: string; at?: string }>>([]);
  const [name, setName] = useState(session.user.displayName);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [push, setPush] = useState<"default" | "granted" | "denied">("default");
  const [exclude, setExclude] = useState<number | null>(null);
  const [out, setOut] = useState(false);

  useEffect(() => {
    void Promise.all([
      api.me(),
      api.friends(),
      api.ledger(),
      api.year(),
      api.notifications(),
    ]).then(([m, f, l, y, n]) => {
      setMe(m.user);
      setWallet(m.wallet);
      setSettings(m.user.settings ?? DEFAULT_SETTINGS);
      persistHaptics(m.user.settings?.haptics ?? true);
      onUser(m.user);
      setFriends(f);
      setLedger(l);
      setYear(y);
      setNotes(n as Array<{ id?: string; template?: string; at?: string }>);
      setName(m.user.displayName);
    });
    if (typeof Notification !== "undefined") setPush(Notification.permission);
  }, [api]);

  async function patch(next: Partial<UserSettings>) {
    const merged = { ...settings, ...next };
    setSettings(merged);
    if (next.haptics !== undefined) persistHaptics(next.haptics);
    try {
      const res = await api.patchSettings(next);
      setSettings(res.settings);
    } catch {
      setSettings(settings);
    }
  }

  const kept = me.kept ?? ledger.filter((r) => r.outcome === "success").length;
  const broken = me.broken ?? ledger.filter((r) => r.outcome === "failure").length;

  if (pane === "account") {
    return (
      <section>
        <Back onClick={() => onPane("root")} />
        <p className="eyebrow">Account</p>
        <h1 className="hero-s">Who you are</h1>
        <label className="label" htmlFor="display-name">Name</label>
        <input id="display-name" className="field" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          type="button"
          className="btn btn-lock mt-3"
          disabled={!name.trim() || name.trim() === me.displayName}
          onClick={() => {
            void api.updateMe({ displayName: name.trim() }).then((r) => {
              setMe(r.user);
              onUser(r.user);
              onFlash("Saved");
            });
          }}
        >
          Save name
        </button>
        <p className="label">Email</p>
        <p className="field readonly">{me.email}</p>
        <p className="muted mt-3">Email is how you sign in. We don't show it to witnesses.</p>
        <button type="button" className="btn btn-ghost mt-4" onClick={() => setOut(true)}>
          Sign out
        </button>
        {out ? (
          <Confirm
            title="Sign out?"
            body="You'll need a new code to get back in. Live promises stay locked."
            confirm="Sign out"
            onYes={onSignOut}
            onNo={() => setOut(false)}
          />
        ) : null}
      </section>
    );
  }

  if (pane === "notifications") {
    return (
      <section>
        <Back onClick={() => onPane("root")} />
        <p className="eyebrow">Notifications</p>
        <h1 className="hero-s">When to tap you</h1>
        <Group>
          <Switch
            label="Leave now"
            hint="One ping when you actually have to go. Not a countdown of guilt."
            on={settings.leaveNow}
            onChange={(leaveNow) => void patch({ leaveNow })}
          />
        </Group>
        <Group>
          <Cell
            label={push === "granted" ? "Alerts on this phone" : "Allow alerts"}
            value={push === "granted" ? "On" : push === "denied" ? "Blocked" : "Off"}
            onClick={() => {
              if (typeof Notification === "undefined") return;
              void Notification.requestPermission().then((p) => setPush(p));
            }}
          />
        </Group>
        <p className="eyebrow mt-4">Inbox</p>
        {notes.length === 0 ? (
          <p className="muted">Quiet. That's the point.</p>
        ) : (
          <Group>
            {notes.map((n, i) => (
              <Cell key={String(n.id ?? i)} label={n.template === "leave_by_now" ? "Leave now" : "Cinch"} value={n.at ? new Date(n.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""} />
            ))}
          </Group>
        )}
      </section>
    );
  }

  if (pane === "friends") {
    return (
      <FriendsPane
        api={api}
        friends={friends}
        setFriends={setFriends}
        email={email}
        setEmail={setEmail}
        err={err}
        setErr={setErr}
        onBack={() => onPane("root")}
        onFlash={onFlash}
      />
    );
  }

  if (pane === "privacy") {
    return (
      <section>
        <Back onClick={() => onPane("root")} />
        <p className="eyebrow">Privacy</p>
        <h1 className="hero-s">What they see</h1>
        <Group>
          <Switch
            label="Hide the stake"
            hint="Witnesses see the promise, not the number, until it settles."
            on={settings.hideStakeOnFeed}
            onChange={(hideStakeOnFeed) => void patch({ hideStakeOnFeed })}
          />
          <Switch
            label="Share after lock"
            hint="Offers the system share sheet so you can send the invite immediately."
            on={settings.shareOnLock}
            onChange={(shareOnLock) => void patch({ shareOnLock })}
          />
        </Group>
        <p className="eyebrow mt-4">Default stake</p>
        <div className="chips">
          {[10, 25, 50, 100].map((n) => (
            <button
              key={n}
              type="button"
              className={settings.defaultStake === n ? "chip on" : "chip"}
              onClick={() => void patch({ defaultStake: n })}
            >
              {n}
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (pane === "safety") {
    return (
      <section>
        <Back onClick={() => onPane("root")} />
        <p className="eyebrow">Safety</p>
        <h1 className="hero-s">Valves, not nags</h1>
        <Group>
          <Cell label="Streak freezes left" value={String(me.freezesLeft ?? 0)} />
          <Cell label="Life-happened voids left" value={String(me.voidsLeft ?? 0)} />
        </Group>
        <p className="muted mt-3">Two freezes a month. One void. That's the whole valve.</p>
        <button
          type="button"
          className="btn btn-ghost mt-4"
          disabled={(me.freezesLeft ?? 0) <= 0}
          onClick={() => {
            void api.freeze().then((r) => {
              if (r.ok) {
                setMe({ ...me, freezesLeft: r.freezesLeft });
                onFlash("Streak holds");
              } else {
                setErr(r.reason ?? "Can't freeze.");
              }
            });
          }}
        >
          Freeze the streak
        </button>
        {err ? <p className="status status-err">{err}</p> : null}
        {me.excludedUntil ? (
          <p className="status status-err">Closed until {me.excludedUntil.slice(0, 10)}. No new stakes.</p>
        ) : (
          <>
            <p className="eyebrow mt-4">Self-exclusion</p>
            <p className="muted">Locks every stake path. Use it if the game is getting to you.</p>
            <div className="chips mt-3">
              {[7, 30, 90].map((d) => (
                <button key={d} type="button" className="chip" onClick={() => setExclude(d)}>
                  {d} days
                </button>
              ))}
            </div>
          </>
        )}
        {exclude ? (
          <Confirm
            danger
            title={`Close stakes for ${exclude} days?`}
            body="You won't be able to lock a new promise until it lifts. Live ones still settle."
            confirm={`Exclude ${exclude} days`}
            onYes={() => {
              void api.exclude(exclude).then((r) => {
                setMe({ ...me, excludedUntil: r.excludedUntil });
                setExclude(null);
                onFlash("Closed");
              });
            }}
            onNo={() => setExclude(null)}
          />
        ) : null}
      </section>
    );
  }

  if (pane === "how") {
    return (
      <section>
        <Back onClick={() => onPane("root")} />
        <p className="eyebrow">How it works</p>
        <h1 className="hero-s">Three moves.</h1>
        <ol className="steps">
          <li>
            <strong>Pick a friend.</strong>
            <span>Someone from your network holds you. If you miss, they get the points.</span>
          </li>
          <li>
            <strong>Lock the promise.</strong>
            <span>Say it like a text. Put points on the line.</span>
          </li>
          <li>
            <strong>Send a photo before time's up.</strong>
            <span>That's the keep. No picture by the deadline — you lose. Automatically.</span>
          </li>
        </ol>
        <p className="muted mt-4">We don't raise the stake after a miss. The house never takes a cut. The board ranks keep rate, then streak.</p>
      </section>
    );
  }

  if (pane === "about") {
    return (
      <section>
        <Back onClick={() => onPane("root")} />
        <p className="eyebrow">About</p>
        <h1 className="hero-s">Cinch</h1>
        <Group>
          <Cell label="Version" value="0.1.0" />
          <Cell label="Stakes" value="Points only" />
          <Cell label="Payments" value="Off" />
        </Group>
        <p className="muted mt-4">
          A friend holds you to it. You pay if you don't. No loot, no nags, no imposed commitments.
        </p>
      </section>
    );
  }

  if (pane === "history") {
    return (
      <section>
        <Back onClick={() => onPane("root")} />
        <p className="eyebrow">History</p>
        <h1 className="hero-s">Every settle</h1>
        <div className="history">
          {ledger.length === 0 ? <p className="muted">Nothing has settled yet.</p> : null}
          {ledger.map((row) => (
            <a key={row.id} href={`/r/${row.id}`}>
              <span>{row.title}</span>
              <span className="nums muted">
                {labelOutcome(row.outcome)}
                {row.stake ? ` · ${formatStake(row.stake.minor)}` : ""}
              </span>
            </a>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <Back label="You" onClick={() => onPane("root")} />
      <p className="eyebrow">Settings</p>
      <h1 className="hero-s">Filled in</h1>
      <Group>
        <Cell label="Account" value={me.displayName} onClick={() => onPane("account")} />
        <Cell label="Notifications" value={settings.leaveNow ? "Leave now" : "Off"} onClick={() => onPane("notifications")} />
        <Cell
          label="Friends"
          value={String(friends.people.length + friends.named.length || "None")}
          onClick={() => onPane("friends")}
        />
      </Group>
      <Group>
        <Cell label="Privacy" onClick={() => onPane("privacy")} />
        <Cell label="Safety" value={me.excludedUntil ? "Excluded" : `${me.freezesLeft ?? 0} freezes`} onClick={() => onPane("safety")} />
      </Group>
      <Group>
        <Cell label="How Cinch works" onClick={() => onPane("how")} />
        <Cell label="About" value="0.1.0" onClick={() => onPane("about")} />
      </Group>
      <p className="muted center mt-4">
        {wallet ? `${formatStake(wallet.available.minor)} available` : null}
        {year ? ` · ${year.kept} kept this year` : kept ? ` · ${kept} kept` : null}
        {broken ? ` · ${broken} missed` : null}
      </p>
    </section>
  );
}

function FriendsPane({
  api,
  friends,
  setFriends,
  email,
  setEmail,
  err,
  setErr,
  onBack,
  onFlash,
}: {
  api: ReturnType<typeof createBrowserApi>;
  friends: FriendsList;
  setFriends: (next: FriendsList) => void;
  email: string;
  setEmail: (v: string) => void;
  err: string;
  setErr: (v: string) => void;
  onBack: () => void;
  onFlash: (label: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function add() {
    setErr("");
    setBusy(true);
    try {
      const res = await api.addFriend(email.trim());
      setEmail("");
      if (res.person) {
        setFriends({
          ...friends,
          people: friends.people.some((p) => p.id === res.person!.id) ? friends.people : [...friends.people, res.person],
        });
      } else {
        setFriends(await api.friends());
      }
      onFlash("Added");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "They need to have signed in once.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <Back onClick={onBack} />
      <p className="eyebrow">Friends</p>
      <h1 className="hero-s">Who can hold you</h1>
      <p className="muted">They have to sign in once. Then you add them by email.</p>
      <label className="sr-only" htmlFor="friend-email">Friend email</label>
      <input
        id="friend-email"
        className="field mt-3"
        type="email"
        placeholder="friend@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="button" className="btn btn-lock mt-3" disabled={busy || !email.includes("@")} onClick={() => void add()}>
        {busy ? "Adding" : "Add friend"}
      </button>
      {err ? <p className="status status-err">{err}</p> : null}

      {friends.people.length === 0 && friends.named.length === 0 ? (
        <p className="muted mt-4">Nobody yet. Name someone when you lock a promise — they show up here.</p>
      ) : null}

      {friends.people.length > 0 ? (
        <>
          <p className="eyebrow mt-4">On Cinch</p>
          <Group>
            {friends.people.map((p) => (
              <div key={p.id} className="cell person">
                <div className="avatar">{initials(p.displayName)}</div>
                <span>
                  <span className="cell-label">{p.displayName}</span>
                  <span className="cell-hint muted">{p.email}</span>
                </span>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => {
                    void api.removeFriend(p.id).then(() => {
                      setFriends({ ...friends, people: friends.people.filter((x) => x.id !== p.id) });
                    });
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </Group>
        </>
      ) : null}

      {friends.named.length > 0 ? (
        <>
          <p className="eyebrow mt-4">Named on promises</p>
          <Group>
            {friends.named.map((n) => (
              <Cell key={n} label={n} value="Not signed in" />
            ))}
          </Group>
        </>
      ) : null}
    </section>
  );
}

function labelOutcome(outcome: string): string {
  if (outcome === "success") return "kept";
  if (outcome === "failure") return "missed";
  if (outcome === "voided") return "void";
  return outcome;
}
