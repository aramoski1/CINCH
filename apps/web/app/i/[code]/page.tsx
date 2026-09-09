"use client";

import { useEffect, useState } from "react";
import { remaining, initials, formatStake } from "../../../lib/format";
import { loadSession } from "../../../lib/session";
import { createBrowserApi, apiBase } from "../../../lib/api";
import { Wordmark, face } from "../../_components/brand";

type Invite = {
  id: string;
  title: string;
  rendered: string;
  stake: { minor: number; hidden?: boolean };
  inviteCode: string;
  deadlineAt?: string;
  outcome?: string | null;
  committer?: { displayName: string };
  partner?: string;
  state?: string;
  nudges?: string[];
  reactions?: string[];
  reacted?: string[];
  witnesses?: string[];
};

export default function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const [code, setCode] = useState("");
  const [invite, setInvite] = useState<Invite | null>(null);
  const [missing, setMissing] = useState(false);
  const [clock, setClock] = useState({ label: "—", risky: false, ms: 0 });
  const [authed, setAuthed] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    setAuthed(Boolean(loadSession()));
    void params.then(async ({ code: c }) => {
      setCode(c);
      const base = apiBase();
      try {
        const res = await fetch(`${base}/v1/invites/${c}`, { cache: "no-store" });
        if (!res.ok) {
          setMissing(true);
          return;
        }
        setInvite((await res.json()) as Invite);
      } catch {
        setMissing(true);
      }
    });
  }, [params]);

  useEffect(() => {
    if (!invite?.deadlineAt) return;
    const tick = () => setClock(remaining(invite.deadlineAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [invite?.deadlineAt]);

  const name = invite?.committer?.displayName ?? "A friend";
  const first = name.split(" ")[0] ?? "them";

  async function showed() {
    if (!invite) return;
    try {
      await createBrowserApi().attest(invite.id, true);
      setNote("Got it. They showed up.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't record that.");
    }
  }

  return (
    <main className="invite-stage">
      <Wordmark size={44} />
      {missing ? (
        <article className="bet">
          <p className="eyebrow">Witness</p>
          <h1 className="hero">This isn't locked yet.</h1>
          <p className="muted">When they lock it, this page is the job.</p>
        </article>
      ) : (
        <article className="bet live" style={{ width: "min(24rem, 100%)" }}>
          <p className="eyebrow">
            {invite?.outcome === "success" ? "Kept" : invite?.outcome === "failure" ? "Missed" : "Hold them to it"}
          </p>
          <div className="who" style={{ marginTop: 0 }}>
            <div className="avatar" style={{ background: face(name) }}>{initials(name)}</div>
            <span>{name}</span>
          </div>
          <h2>{invite?.title ?? "…"}</h2>
          <p className="muted">{invite?.rendered}</p>
          <p className={clock.risky ? "clock nums hot" : "clock nums"}>{invite ? clock.label : "—"}</p>
          <p className="stake nums" style={{ marginLeft: 0, marginTop: "0.75rem" }}>
            {invite?.stake.hidden ? "Hidden until the end" : invite ? formatStake(invite.stake.minor) : ""} on the line
          </p>
          <dl className="meta-list">
            <div>
              <dt>Witness</dt>
              <dd>{invite?.partner ?? "you"}</dd>
            </div>
            <div>
              <dt>Proof</dt>
              <dd>Photo, or they lose</dd>
            </div>
            <div>
              <dt>Why it matters</dt>
              <dd>Someone who cares is in the room.</dd>
            </div>
          </dl>
          <p className="muted">Private by default. This pact is only visible to you and your witness.</p>
          {authed ? (
            <div className="stack mt-4">
              <button type="button" className="btn btn-lock" onClick={() => void showed()}>
                They showed up
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  if (!invite) return;
                  void createBrowserApi()
                    .attest(invite.id, false)
                    .then(() => setNote("Recorded. They missed."))
                    .catch((e) => setNote(e instanceof Error ? e.message : "Couldn't record that."));
                }}
              >
                They didn't
              </button>
            </div>
          ) : (
            <a className="hold mt-4" href={`/?invite=${code}`}>
              Hold {first} to it
            </a>
          )}
          {authed && invite?.nudges?.length ? (
            <div className="filters mt-3">
              {invite.nudges.map((line) => (
                <button
                  key={line}
                  type="button"
                  className="chip"
                  onClick={() =>
                    void createBrowserApi()
                      .nudge(invite.id, line)
                      .then(() => setNote(line))
                      .catch((e) => setNote(e instanceof Error ? e.message : "One shot."))
                  }
                >
                  {line}
                </button>
              ))}
            </div>
          ) : null}
          {authed && invite?.reactions?.length ? (
            <div className="filters mt-3">
              {invite.reactions.map((line) => (
                <button
                  key={line}
                  type="button"
                  className="chip"
                  onClick={() =>
                    void createBrowserApi()
                      .reactVerdict(invite.id, line)
                      .then(() => setNote(line))
                      .catch((e) => setNote(e instanceof Error ? e.message : "Couldn't stamp that."))
                  }
                >
                  {line}
                </button>
              ))}
            </div>
          ) : null}
          {note ? <p className="ok mt-3">{note}</p> : null}
          <a className="text-btn center mt-4" href="/">
            Open Cinch
          </a>
        </article>
      )}
    </main>
  );
}
