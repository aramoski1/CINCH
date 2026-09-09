"use client";

import { useEffect, useRef, useState } from "react";
import type { AuthSession, CommitmentRow, WatchingRow } from "@cinch/api-client";
import { createBrowserApi } from "../../lib/api";
import { formatStake, initials, remaining } from "../../lib/format";
import { compressPhoto } from "../../lib/photo";
import { Wordmark, face } from "./brand";
import { Confirm } from "./ui";
import { ProofCamera } from "./proof-camera";
import { WeeklySignal, WinShare } from "./signal";
import { CheckInCard } from "./check-in";
import { ActivityTrail } from "./activity-trail";
import type { LedgerBit } from "../../lib/signal";

export function HomeScreen({
  api,
  session,
  inviteCode,
  onCompose,
  onFlash,
}: {
  api: ReturnType<typeof createBrowserApi>;
  session: AuthSession;
  inviteCode: string | null;
  onCompose: () => void;
  onFlash: (label: string) => void;
}) {
  const [rows, setRows] = useState<CommitmentRow[] | undefined>(undefined);
  const [watching, setWatching] = useState<WatchingRow[]>([]);
  const [ledger, setLedger] = useState<LedgerBit[]>([]);
  const [hits, setHits] = useState<Array<{ title: string; them: string; category: string }>>([]);
  const [tick, setTick] = useState(0);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [tearing, setTearing] = useState<string | null>(null);
  const [miss, setMiss] = useState<CommitmentRow | null>(null);
  const [voiding, setVoiding] = useState<CommitmentRow | null>(null);
  const [shot, setShot] = useState<{ row: CommitmentRow; preview: string } | null>(null);
  const [cameraFor, setCameraFor] = useState<CommitmentRow | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<CommitmentRow | null>(null);

  async function refresh() {
    try {
      const [next, hold, book, bump] = await Promise.all([
        api.activeCommitments(),
        api.watching(),
        api.ledger(),
        api.collisions().catch(() => []),
      ]);
      setRows(next);
      setWatching(hold);
      setLedger(book);
      setHits(bump);
      setErr("");
    } catch {
      setErr("Couldn't load. Try again.");
    }
  }

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!inviteCode) return;
    void (async () => {
      try {
        const preview = await api.invitePreview(inviteCode);
        await api.accept(preview.id);
        setNote(`You're on ${preview.committer?.displayName ?? "their"} promise.`);
        await refresh();
      } catch {
        setNote("Open the invite when they lock it.");
      }
    })();
  }, [inviteCode]);

  useEffect(() => {
    if (!rows?.length) return;
    const overdue = rows.some((row) => remaining(row.spec.schedule?.deadline_at).ms <= 0);
    if (overdue) void refresh();
  }, [tick]);

  async function copyInvite(code: string, title: string) {
    const url = `${window.location.origin}/i/${code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `Hold me to this. ${title}`, url }).catch(() => undefined);
      }
      await navigator.clipboard.writeText(url);
      onFlash("Link copied");
    } catch {
      onFlash("Link copied");
    }
  }

  async function pickPhoto(row: CommitmentRow) {
    target.current = row;
    setCameraFor(row);
  }

  function openLibrary() {
    setCameraFor(null);
    fileRef.current?.click();
  }

  async function onFile(file: File | undefined) {
    const row = target.current;
    if (!file || !row) return;
    try {
      const preview = await compressPhoto(file);
      setShot({ row, preview });
    } catch {
      setErr("Couldn't read that photo.");
    }
  }

  async function sendProof() {
    if (!shot) return;
    setBusy(true);
    setErr("");
    try {
      const { nonce } = await api.nonce();
      await api.proof(shot.row.id, nonce, shot.preview);
      setShot(null);
      setErr("");
      onFlash("Proved it");
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send the photo.");
    } finally {
      setBusy(false);
    }
  }

  if (rows === undefined && !err) {
    return (
      <section>
        <Wordmark size={36} />
        <p className="eyebrow">{session.user.displayName}</p>
        <div className="skel hero-skel" />
        <div className="skel card-skel" />
      </section>
    );
  }

  if ((!rows || rows.length === 0) && watching.length === 0) {
    return (
      <section className="empty">
        <Wordmark size={48} />
        <p className="eyebrow">{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</p>
        <h1 className="hero">Make it real,<br /><em>then make it happen.</em></h1>
        <p className="lede">Pick a friend. Lock a promise. Beat the clock with a photo.</p>
        <WinShare ledger={ledger} streak={session.user.streak} />
        {hits[0] ? <p className="ok">You and {hits[0].them} both have a live {hits[0].category} streak.</p> : null}
        <ol className="steps tight">
          <li>
            <strong>Pick them.</strong>
            <span>Someone from your network holds you.</span>
          </li>
          <li>
            <strong>Lock it.</strong>
            <span>Points on the line.</span>
          </li>
          <li>
            <strong>Prove it.</strong>
            <span>No photo by the deadline — you lose.</span>
          </li>
        </ol>
        {note ? <p className="ok">{note}</p> : null}
        {err ? <p className="status status-err">{err}</p> : null}
        <button type="button" className="btn btn-lock" onClick={onCompose}>
          Make a promise
        </button>
        {err ? (
          <button type="button" className="btn btn-ghost mt-3" onClick={() => void refresh()}>
            Try again
          </button>
        ) : null}
        <div className="mt-4">
          <ActivityTrail api={api} limit={3} compact />
        </div>
      </section>
    );
  }

  return (
    <section>
      <Wordmark size={36} />
      <p className="eyebrow">{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</p>
      {note ? <p className="ok">{note}</p> : null}
      {err ? <p className="status status-err">{err}</p> : null}
      <p className="hero-s">{session.user.displayName.split(" ")[0]}, make it happen.</p>
      <WinShare ledger={ledger} streak={session.user.streak} />
      <WeeklySignal ledger={ledger} compact />
      {hits[0] ? <p className="ok">You and {hits[0].them} are both on {hits[0].category}.</p> : null}
      <p className="eyebrow mt-4">On your hook</p>
      <input
        ref={fileRef}
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {rows?.map((row, i) => {
        const clock = remaining(row.spec.schedule?.deadline_at);
        const friend = row.spec.partners?.[0]?.ref ?? "Your friend";
        return (
          <article key={row.id} className={tearing === row.id ? "bet live fail mt-4" : "bet live mt-4"}>
            <p className="eyebrow">On your hook · {row.hasPhoto ? "Proof in" : "Photo due"}</p>
            <h2>{row.spec.title}</h2>
            <p className={clock.risky ? "clock nums hot" : "clock nums"} aria-live="polite">
              {clock.label}
            </p>
            <div className="who">
              <div className="avatar" aria-hidden="true" style={{ background: face(friend) }}>{initials(friend)}</div>
              <span>{friend} is holding you</span>
              <span className="stake nums">{formatStake(row.spec.stake.amount.minor)}</span>
            </div>
            <p className="muted mt-3">Private. Take a live photo of the thing, or they collect.</p>
            {i === 0 ? <CheckInCard api={api} about={row.spec.title} /> : null}
            <div className="stack mt-4">
              <button type="button" className="btn btn-lock" onClick={() => void pickPhoto(row)}>
                Take proof
              </button>
              <button type="button" className="btn btn-danger" onClick={() => setMiss(row)}>
                I didn't
              </button>
            </div>
            <div className="row-actions">
              <button type="button" className="text-btn" onClick={() => void copyInvite(row.inviteCode, row.spec.title)}>
                Share invite
              </button>
              <button type="button" className="text-btn" onClick={() => setVoiding(row)}>
                Life happened
              </button>
            </div>
          </article>
        );
      })}

      {watching.length > 0 ? (
        <>
          <p className="eyebrow mt-4">You're holding</p>
          {watching.map((row) => {
            const clock = remaining(row.deadlineAt);
            return (
              <article key={row.id} className="bet mt-3">
                <div className="who" style={{ marginTop: 0 }}>
                  <div className="avatar" style={{ background: face(row.committer) }}>{initials(row.committer)}</div>
                  <span>{row.committer}</span>
                  <span className="stake nums">{formatStake(row.stake.minor)}</span>
                </div>
                <h3 className="watch-title">{row.title}</h3>
                <p className={clock.risky ? "nums hot" : "nums"}>{clock.label}</p>
                <p className="muted">{row.hasPhoto ? "Proof in." : "Waiting on their photo."}</p>
                <a className="text-btn" href={`/i/${row.inviteCode}`}>Open invite</a>
              </article>
            );
          })}
        </>
      ) : null}

      <div className="mt-4">
        <ActivityTrail api={api} limit={5} compact />
      </div>

      {cameraFor ? (
        <ProofCamera
          title={cameraFor.spec.title}
          onCapture={(preview) => {
            setShot({ row: cameraFor, preview });
            setCameraFor(null);
          }}
          onLibrary={openLibrary}
          onClose={() => setCameraFor(null)}
        />
      ) : null}

      {shot ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Send proof">
          <div className="sheet">
            <p className="eyebrow">Proof</p>
            <h2>{shot.row.spec.title}</h2>
            <img className="proof" src={shot.preview} alt="Your proof" />
            <p className="muted">We'll check it's you doing the thing — not a screenshot or an old still.</p>
            {err ? <p className="status status-err" role="alert">{err}</p> : null}
            <div className="stack mt-4">
              <button type="button" className="btn btn-lock" disabled={busy} onClick={() => void sendProof()}>
                {busy ? "Checking" : "Send proof"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  const row = shot.row;
                  setShot(null);
                  setCameraFor(row);
                }}
              >
                Retake
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {miss ? (
        <Confirm
          danger
          title="You missed."
          body={`${formatStake(miss.spec.stake.amount.minor)} goes to ${miss.spec.partners?.[0]?.ref ?? "them"}. No photo. That's the rule.`}
          confirm="I missed"
          onYes={() => {
            const row = miss;
            setMiss(null);
            setTearing(row.id);
            window.setTimeout(() => {
              void api.honestFail(row.id).then(() => {
                onFlash("You missed");
                setTearing(null);
                void refresh();
              });
            }, 650);
          }}
          onNo={() => setMiss(null)}
        />
      ) : null}

      {voiding ? (
        <Confirm
          title="Life happened?"
          body="One void. The bet closes clean. Nobody pays."
          confirm="Void it"
          onYes={() => {
            void api.lifeHappens(voiding.id).then((r) => {
              setVoiding(null);
              if (r.ok) onFlash("Voided");
              else setErr("No voids left.");
              void refresh();
            });
          }}
          onNo={() => setVoiding(null)}
        />
      ) : null}
    </section>
  );
}
