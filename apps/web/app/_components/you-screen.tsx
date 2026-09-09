"use client";

import { useEffect, useState } from "react";
import type { AuthSession, FriendsList, Leaderboard, UserSettings, Wallet } from "@cinch/api-client";
import { DEFAULT_SETTINGS } from "@cinch/api-client";
import { createBrowserApi } from "../../lib/api";
import { formatStake, initials, streakTier, xpFill } from "../../lib/format";
import { persistHaptics } from "../../lib/prefs";
import { Wordmark, face } from "./brand";
import { Pulse } from "./signal";
import { CommunityHub } from "./community-hub";
import { SettingsStack, type SettingsPane } from "./settings";
import { Cell, Group } from "./ui";

export function YouScreen({
  api,
  session,
  onSignOut,
  onUser,
  onFlash,
  onCompose,
}: {
  api: ReturnType<typeof createBrowserApi>;
  session: AuthSession;
  onSignOut: () => void;
  onUser: (next: AuthSession["user"]) => void;
  onFlash: (label: string) => void;
  onCompose: () => void;
}) {
  const [pane, setPane] = useState<SettingsPane | "you">("you");
  const [me, setMe] = useState(session.user);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [friends, setFriends] = useState<FriendsList>({ people: [], named: [] });
  const [ledger, setLedger] = useState<Array<{ id: string; title: string; outcome: string; at?: string; stake: { minor: number } | null }>>([]);
  const [year, setYear] = useState<{ kept: number; broken: number; voided: number } | null>(null);
  const [settings, setSettings] = useState<UserSettings>(session.user.settings ?? DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [coach, setCoach] = useState<Awaited<ReturnType<typeof api.coach>> | null>(null);
  const [truth, setTruth] = useState<Awaited<ReturnType<typeof api.truth>> | null>(null);
  const [witness, setWitness] = useState<{ kept: number; tried: number; rate: number } | null>(null);
  const [question, setQuestion] = useState<Awaited<ReturnType<typeof api.openQuestion>> | null>(null);
  const [standing, setStanding] = useState<Awaited<ReturnType<typeof api.standing>> | null>(null);
  const [protocols, setProtocols] = useState<Array<{ id: string; name: string; utterance: string; why: string }>>([]);

  useEffect(() => {
    void Promise.all([
      api.me(),
      api.friends(),
      api.ledger(),
      api.year(),
      api.leaderboard(),
      api.coach(),
      api.truth(),
      api.witnessRecord().catch(() => null),
      api.openQuestion().catch(() => null),
      api.standing().catch(() => null),
      api.protocols().catch(() => []),
    ]).then(([m, f, l, y, b, c, t, w, q, s, p]) => {
      setMe(m.user);
      setWallet(m.wallet);
      setSettings(m.user.settings ?? DEFAULT_SETTINGS);
      persistHaptics(m.user.settings?.haptics ?? true);
      onUser(m.user);
      setFriends(f);
      setLedger(l);
      setYear(y);
      setBoard(b);
      setCoach(c);
      setTruth(t);
      setWitness(w);
      setQuestion(q);
      setStanding(s);
      setProtocols(p);
      setLoaded(true);
    });
  }, [api]);

  if (pane !== "you") {
    return (
      <div className="settings-stack">
        <SettingsStack
          api={api}
          session={{ ...session, user: me }}
          pane={pane}
          onPane={(next) => setPane(next === "root" ? "you" : next)}
          onSignOut={onSignOut}
          onUser={(u) => {
            setMe(u);
            onUser(u);
          }}
          onFlash={onFlash}
        />
      </div>
    );
  }

  const kept = me.kept ?? year?.kept ?? ledger.filter((r) => r.outcome === "success").length;
  const broken = me.broken ?? year?.broken ?? ledger.filter((r) => r.outcome === "failure").length;
  const cash = wallet ? formatStake(wallet.available.minor) : "—";
  const xp = xpFill(me.score ?? 500);
  const fire = streakTier(me.streak);

  return (
    <section>
      <Wordmark size={36} />
      <div className="you-head">
        <div
          className={`avatar avatar-lg ${fire}`}
          aria-hidden="true"
          style={{ background: face(me.displayName) }}
        >
          {initials(me.displayName)}
        </div>
        <div>
          <p className="eyebrow">Player</p>
          <h1 className="hero-s">{me.displayName}</h1>
          <p className="muted">{me.email}</p>
        </div>
        <button type="button" className="gear" aria-label="Settings" onClick={() => setPane("root")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
            <path
              d="M12 3.5v2.2M12 18.3V20.5M4.7 7.2l1.9 1.1M17.4 15.7l1.9 1.1M4.7 16.8l1.9-1.1M17.4 8.3l1.9-1.1"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="xp">
        <div className="xp-top">
          <span>Level {Math.max(1, Math.floor(((me.score ?? 500) - 300) / 60) + 1)}</span>
          <span className="nums">{me.score ?? 500} XP</span>
        </div>
        <div className="xp-bar" aria-hidden="true">
          <i style={{ width: `${xp}%` }} />
        </div>
      </div>

      <div className="stats">
        <div className={fire}>
          <span className="nums">{me.streak}</span>
          <span>streak</span>
        </div>
        <div>
          <span className="nums">{kept}</span>
          <span>kept</span>
        </div>
        <div>
          <span className="nums">{broken}</span>
          <span>missed</span>
        </div>
        <div>
          <span className="nums">{cash}</span>
          <span>dollars</span>
        </div>
      </div>

      {me.excludedUntil ? (
        <p className="status status-err">Self-excluded until {me.excludedUntil.slice(0, 10)}</p>
      ) : null}

      <Pulse board={board} insight={coach?.insight} heat={truth?.heat} ledger={ledger} />
      {board?.rival ? (
        <p className="rival">
          {board.you && board.you.rank === 1
            ? `You're #1. ${board.board[1]?.displayName ?? "The pack"} is hunting.`
            : `${board.rival.displayName} is #${board.rival.rank} at ${board.rival.rate}%. Catch them.`}
        </p>
      ) : null}
      {witness && witness.tried > 0 ? <p className="ok nums">Kept to you: {witness.rate}%</p> : null}

      <CommunityHub
        api={api}
        board={board}
        friends={friends}
        protocols={protocols}
        standing={standing}
        question={question}
        onQuestion={setQuestion}
        onCompose={onCompose}
        onFlash={onFlash}
      />

      <p className="eyebrow mt-4">History</p>
      <div className="history">
        {!loaded ? <p className="muted">Loading…</p> : null}
        {loaded && ledger.length === 0 ? (
          <div className="empty-card">
            <p>No settles yet.</p>
            <button type="button" className="btn btn-lock mt-3" onClick={onCompose}>
              Make a promise
            </button>
          </div>
        ) : null}
        {ledger.slice(0, 5).map((row) => (
          <a key={row.id} href={`/r/${row.id}`}>
            <span>{row.title}</span>
            <span className="nums muted">
              {row.outcome === "success" ? "kept" : row.outcome === "failure" ? "missed" : row.outcome}
              {row.stake ? ` · ${formatStake(row.stake.minor)}` : ""}
            </span>
          </a>
        ))}
      </div>
      {ledger.length > 5 ? (
        <button type="button" className="text-btn mt-3" onClick={() => setPane("history")}>
          See all
        </button>
      ) : null}

      <p className="eyebrow mt-4">Settings</p>
      <Group>
        <Cell label="Account" value={me.displayName} onClick={() => setPane("account")} />
        <Cell label="Notifications" value={settings.leaveNow ? "On" : "Off"} onClick={() => setPane("notifications")} />
        <Cell label="Privacy" onClick={() => setPane("privacy")} />
        <Cell label="Safety" value={`${me.freezesLeft ?? 0} freezes`} onClick={() => setPane("safety")} />
        <Cell label="How it works" onClick={() => setPane("how")} />
        <Cell label="About" value="0.1.0" onClick={() => setPane("about")} />
      </Group>
    </section>
  );
}
