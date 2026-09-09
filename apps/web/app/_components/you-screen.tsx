"use client";

import { useEffect, useState } from "react";
import type { AuthSession, FriendsList, Leaderboard, UserSettings, Wallet } from "@cinch/api-client";
import { DEFAULT_SETTINGS } from "@cinch/api-client";
import { createBrowserApi } from "../../lib/api";
import { formatStake, initials } from "../../lib/format";
import { persistHaptics } from "../../lib/prefs";
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
  const [ledger, setLedger] = useState<Array<{ id: string; title: string; outcome: string; stake: { minor: number } | null }>>([]);
  const [year, setYear] = useState<{ kept: number; broken: number; voided: number } | null>(null);
  const [settings, setSettings] = useState<UserSettings>(session.user.settings ?? DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [board, setBoard] = useState<Leaderboard | null>(null);

  useEffect(() => {
    void Promise.all([api.me(), api.friends(), api.ledger(), api.year(), api.leaderboard()]).then(([m, f, l, y, b]) => {
      setMe(m.user);
      setWallet(m.wallet);
      setSettings(m.user.settings ?? DEFAULT_SETTINGS);
      persistHaptics(m.user.settings?.haptics ?? true);
      onUser(m.user);
      setFriends(f);
      setLedger(l);
      setYear(y);
      setBoard(b);
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

  const friendNames = [...friends.people.map((p) => p.displayName), ...friends.named].slice(0, 3);
  const kept = me.kept ?? year?.kept ?? ledger.filter((r) => r.outcome === "success").length;
  const broken = me.broken ?? year?.broken ?? ledger.filter((r) => r.outcome === "failure").length;
  const points = wallet ? formatStake(wallet.available.minor) : "—";

  return (
    <section>
      <div className="you-head">
        <div className="avatar avatar-lg" aria-hidden="true">{initials(me.displayName)}</div>
        <div>
          <p className="eyebrow">You</p>
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

      <div className="stats">
        <div>
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
          <span className="nums">{points}</span>
          <span>points</span>
        </div>
      </div>

      {me.excludedUntil ? (
        <p className="status status-err">Self-excluded until {me.excludedUntil.slice(0, 10)}</p>
      ) : null}

      {board?.rival ? (
        <p className="rival">
          {board.you && board.you.rank === 1
            ? `You're #1. ${board.board[1]?.displayName ?? "The pack"} is hunting.`
            : `${board.rival.displayName} is #${board.rival.rank}. ${board.rival.rate}% kept. Catch them.`}
        </p>
      ) : null}

      <p className="eyebrow">Board</p>
      {board && board.board.length > 1 ? (
        <ol className="board">
          {board.board.map((row) => (
            <li key={row.id} className={row.you ? "you" : ""}>
              <span className="nums rank">{row.rank}</span>
              <div className="avatar sm">{initials(row.displayName)}</div>
              <span>
                {row.displayName}
                {row.you ? " · you" : ""}
              </span>
              <span className="nums muted">
                {row.rate}% · {row.streak} streak
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">Add a friend from Promise and the board lights up. Ranked by keep rate, then streak.</p>
      )}

      <p className="eyebrow mt-4">Friends</p>
      {friendNames.length === 0 ? (
        <p className="muted">Name someone when you lock a promise. Or add them by email.</p>
      ) : (
        <div className="who-row">
          {friendNames.map((n) => (
            <div key={n} className="pill">
              <div className="avatar sm">{initials(n)}</div>
              {n}
            </div>
          ))}
        </div>
      )}
      <button type="button" className="text-btn mt-3" onClick={() => setPane("friends")}>
        Manage friends
      </button>

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
