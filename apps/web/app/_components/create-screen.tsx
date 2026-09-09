"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, type FriendPerson } from "@cinch/api-client";
import { createBrowserApi } from "../../lib/api";
import { formatStake, initials } from "../../lib/format";
import { rememberFriend } from "../../lib/prefs";
import { defaultDeadlineLocal, toDatetimeLocal } from "../../lib/signal";
import { Wordmark, face } from "./brand";

const STAKES = [10, 25, 50, 100];

export function CreateScreen({
  api,
  online,
  onLocked,
}: {
  api: ReturnType<typeof createBrowserApi>;
  online: boolean;
  onLocked: () => void;
}) {
  const [people, setPeople] = useState<FriendPerson[]>([]);
  const [named, setNamed] = useState<string[]>([]);
  const [picked, setPicked] = useState<FriendPerson | { name: string } | null>(null);
  const [email, setEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [utterance, setUtterance] = useState("");
  const [stake, setStake] = useState(25);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [dueAt, setDueAt] = useState(defaultDeadlineLocal);
  const [step, setStep] = useState<1 | 2>(1);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [shareOnLock, setShareOnLock] = useState(true);
  const gen = useRef(0);

  async function loadPeople() {
    const list = await api.friends();
    setPeople(list.people);
    setNamed(list.named);
  }

  useEffect(() => {
    void loadPeople();
    void api.me().then((m) => {
      const settings = m.user.settings ?? DEFAULT_SETTINGS;
      setStake(settings.defaultStake);
      setShareOnLock(settings.shareOnLock);
    });
  }, [api]);

  useEffect(() => {
    const trimmed = utterance.trim();
    if (trimmed.length < 8) {
      setTitle("");
      setWhen("");
      return;
    }
    const n = ++gen.current;
    const id = window.setTimeout(() => {
      void api.parse(trimmed).then((body) => {
        if (n !== gen.current) return;
        if ("blocked" in body && body.blocked) {
          setErr(body.message);
          return;
        }
        if (!("spec" in body) || !body.spec) return;
        setErr("");
        const spec = body.spec as {
          title?: string;
          schedule?: { deadline_at?: string };
          stake?: { amount?: { minor?: number } };
        };
        setTitle(spec.title ?? "");
        if (spec.schedule?.deadline_at) {
          const deadline = new Date(spec.schedule.deadline_at);
          setWhen(
            deadline.toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }),
          );
          if (step === 1) setDueAt(toDatetimeLocal(deadline));
        }
        if (spec.stake?.amount?.minor) {
          const minor = spec.stake.amount.minor;
          setStake(minor >= 100 && minor % 100 === 0 ? minor / 100 : minor);
        }
      }).catch(() => undefined);
    }, 280);
    return () => window.clearTimeout(id);
  }, [utterance, api, step]);

  async function add() {
    setErr("");
    setBusy(true);
    try {
      const res = await api.addFriend(email.trim());
      setEmail("");
      await loadPeople();
      if (res.person) setPicked(res.person);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "They have to sign in once first.");
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    if (!online) return setErr("You're offline.");
    if (!picked) return setErr("Pick who holds you to this.");
    if (utterance.trim().length < 4) return setErr("Say the promise.");
    const deadline = new Date(dueAt);
    if (Number.isNaN(deadline.getTime())) return setErr("Pick a deadline that's still ahead.");
    setBusy(true);
    setErr("");
    const name = "id" in picked ? picked.displayName : picked.name;
    try {
      await api.patchSettings({ defaultStake: stake }).catch(() => undefined);
      const locked = await api.lock({
        utterance: utterance.trim(),
        friend: name,
        friendId: "id" in picked ? picked.id : undefined,
        stake,
        deadlineAt: deadline.toISOString(),
      });
      rememberFriend(name);
      if (shareOnLock) {
        const url = locked.shareUrl;
        if (navigator.share) {
          await navigator.share({ title: locked.title, text: `Hold me to this. ${locked.title}`, url }).catch(() => undefined);
        } else {
          await navigator.clipboard.writeText(url).catch(() => undefined);
        }
      }
      onLocked();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't lock it. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const friendName = picked ? ("id" in picked ? picked.displayName : picked.name) : "";
  const canContinue = Boolean(picked) && utterance.trim().length > 3 && !busy;
  const canLock = canContinue && Boolean(dueAt);

  return (
    <section>
      <Wordmark size={36} />
      <p className="eyebrow">A private pact</p>
      <h1 className="hero">Put one thing<br /><em>on the line.</em></h1>
      <div className="stepper" aria-label="Promise steps">
        <div className={step === 1 ? "step on" : "step done"}>
          <span className="step-number">{step > 1 ? "✓" : "1"}</span> Promise
        </div>
        <span className="step-line" />
        <div className={step === 2 ? "step on" : "step"}>
          <span className="step-number">2</span> Pact
        </div>
      </div>

      {step === 1 ? (
        <>
          <p className="lede">Pick who holds you. Say it like a text. We'll catch the time.</p>

          {people.length === 0 && named.length === 0 ? (
            <p className="muted">They sign in once. You add their email. Then they're on the board.</p>
          ) : null}

          <div className="people">
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                className={picked && "id" in picked && picked.id === p.id ? "person-card on" : "person-card"}
                onClick={() => setPicked(p)}
              >
                <div className="avatar" style={{ background: face(p.displayName) }}>{initials(p.displayName)}</div>
                <span>{p.displayName}</span>
                <small>On Cinch</small>
              </button>
            ))}
            {named.map((n) => (
              <button
                key={n}
                type="button"
                className={picked && !("id" in picked) && picked.name === n ? "person-card on" : "person-card"}
                onClick={() => setPicked({ name: n })}
              >
                <div className="avatar" style={{ background: face(n) }}>{initials(n)}</div>
                <span>{n}</span>
                <small>Invite only</small>
              </button>
            ))}
          </div>

          <p className="eyebrow mt-4">Add someone</p>
          <input
            className="field"
            type="email"
            placeholder="friend@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Friend email"
          />
          <button type="button" className="btn btn-ghost mt-3" disabled={busy || !email.includes("@")} onClick={() => void add()}>
            Add to network
          </button>
          <p className="muted mt-3">Not on Cinch yet? Name them. They hold you from the invite link.</p>
          <input
            className="field mt-3"
            placeholder="Name"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            aria-label="Name if they're not on Cinch"
          />
          <button
            type="button"
            className="btn btn-ghost mt-3"
            disabled={!inviteName.trim()}
            onClick={() => setPicked({ name: inviteName.trim() })}
          >
            Hold with invite
          </button>

          {picked ? (
            <>
              <p className="eyebrow mt-4">The promise</p>
              <p className="ok">{friendName} is holding you.</p>
              <textarea
                className="area mt-3"
                placeholder="Gym tomorrow at 6:30 or I pay $25"
                value={utterance}
                onChange={(e) => setUtterance(e.target.value)}
                aria-label="Promise"
              />
              {title ? (
                <div className="preview">
                  <p className="muted">{title}{when ? ` · ${when}` : ""}</p>
                </div>
              ) : (
                <p className="muted mt-3">Start with a verb. Clear enough that they could call you on it.</p>
              )}
            </>
          ) : null}

          {err ? <p className="status status-err" role="alert">{err}</p> : null}
          <button
            type="button"
            className="btn btn-lock mt-4"
            disabled={!canContinue}
            onClick={() => {
              setErr("");
              setStep(2);
            }}
          >
            Shape the pact
          </button>
        </>
      ) : (
        <>
          <p className="lede">A consequence is friction, not punishment. Photo proof or they collect.</p>
          <div className="review">
            <span>Your promise</span>
            <strong>{title || utterance}</strong>
          </div>
          <div className="review">
            <span>Witness</span>
            <strong>{friendName}</strong>
          </div>

          <p className="eyebrow">On the line</p>
          <p className="clock nums">{formatStake(stake * 100)}</p>
          <div className="chips">
            {STAKES.map((n) => (
              <button key={n} type="button" className={stake === n ? "chip on" : "chip"} onClick={() => setStake(n)}>
                ${n}
              </button>
            ))}
          </div>

          <p className="eyebrow mt-4">The line is drawn at</p>
          <input
            className="field"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            aria-label="Deadline"
          />
          <p className="muted mt-3">
            Prove it with a photo before then. Miss the picture and {formatStake(stake * 100)} goes to {friendName}.
          </p>
          {err ? <p className="status status-err" role="alert">{err}</p> : null}
          <button type="button" className="btn btn-lock mt-4" disabled={!canLock} onClick={() => void lock()}>
            {busy ? "Locking" : "Lock it"}
          </button>
          <button type="button" className="btn btn-ghost mt-3" onClick={() => setStep(1)}>
            Back
          </button>
        </>
      )}
    </section>
  );
}
