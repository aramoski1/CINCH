"use client";

import { useEffect, useState } from "react";
import type { AuthSession, GroupRow } from "@cinch/api-client";
import { createBrowserApi } from "../../lib/api";
import { initials } from "../../lib/format";

export function ProfileScreen({
  api,
  session,
  onSignOut,
}: {
  api: ReturnType<typeof createBrowserApi>;
  session: AuthSession;
  onSignOut: () => void;
}) {
  const [coach, setCoach] = useState<{
    insight: { text: string };
    stats: string[];
    categories: { fitness: number; focus: number; social: number };
    mayRaiseStake: boolean;
  } | null>(null);
  const [me, setMe] = useState(session.user);
  const [note, setNote] = useState("");
  const [truth, setTruth] = useState<Awaited<ReturnType<typeof api.truth>> | null>(null);
  const [year, setYear] = useState<Awaited<ReturnType<typeof api.year>> | null>(null);
  const [ledger, setLedger] = useState<Awaited<ReturnType<typeof api.ledger>>>([]);
  const [witness, setWitness] = useState<{ kept: number; tried: number; rate: number } | null>(null);
  const [q, setQ] = useState<Awaited<ReturnType<typeof api.openQuestion>> | null>(null);
  const [challenges, setChallenges] = useState<Awaited<ReturnType<typeof api.challenges>>>([]);
  const [chalEmail, setChalEmail] = useState("");
  const [chalText, setChalText] = useState("");

  useEffect(() => {
    void Promise.all([
      api.me(),
      api.coach(),
      api.truth(),
      api.year(),
      api.ledger(),
      api.witnessRecord(),
      api.openQuestion(),
      api.challenges(),
    ]).then(([m, c, t, y, l, w, oq, ch]) => {
      setMe(m.user);
      setCoach(c);
      setTruth(t);
      setYear(y);
      setLedger(l);
      setWitness(w);
      setQ(oq);
      setChallenges(ch);
    });
  }, [api]);

  const cats = coach?.categories ?? me.categories ?? { fitness: 500, focus: 500, social: 500 };
  const building = (me.score ?? 500) <= 520;

  return (
    <section>
      <div className="face face-lg" aria-hidden="true">{initials(me.displayName)}</div>
      <p className="nums nums-score">{building ? "----" : me.score}</p>
      <p className="muted">{building ? "Building. Four more commitments before a score exists." : "Accountability score. Money can't buy this."}</p>
      <p>{me.streak} day streak. {me.freezesLeft ?? 2} freezes left.</p>
      {witness && witness.tried > 0 ? (
        <p className="ok nums">Promises kept to you: {witness.rate}%</p>
      ) : (
        <p className="muted">Witness record appears once people start keeping promises to you.</p>
      )}

      <h2 className="display-s mt-4">Category</h2>
      {(["fitness", "focus", "social"] as const).map((k) => (
        <div key={k} className="cat">
          <span>{k}</span>
          <div className="bar">
            <i style={{ ["--fill" as string]: `${((cats[k] - 300) / 600) * 100}%` }} />
          </div>
          <span className="nums">{cats[k]}</span>
        </div>
      ))}

      <h2 className="display-s mt-4">When you follow through</h2>
      <div className="heat" aria-label="Time of day heatmap">
        {(truth?.heat ?? []).map((h) => (
          <i
            key={h.hour}
            title={`${h.hour}:00 ${h.rate}%`}
            style={{ opacity: h.tried ? 0.15 + (h.rate / 100) * 0.85 : 0.08 }}
          />
        ))}
      </div>
      {(truth?.cards ?? []).map((c) => (
        <p key={c.headline} className="ok">{c.phrase}</p>
      ))}
      {truth?.split ? <p>{truth.split.line}</p> : <p className="muted">Patterns print when they hit significance. Never on a schedule.</p>}

      {year ? (
        <>
          <h2 className="display-s mt-4">The year. Honest.</h2>
          <p className="nums">{year.kept} kept · {year.broken} broken · {year.voided} voided</p>
          {year.hardestKept ? <p>Hardest one finished: {year.hardestKept}</p> : null}
          {year.givenUpThreeTimes ? <p>Gave up three times: {year.givenUpThreeTimes}</p> : null}
        </>
      ) : null}

      <h2 className="display-s mt-4">The ledger</h2>
      <p className="muted">Every card. Kept and broken. No filter.</p>
      <div className="ledger">
        {ledger.map((row) => (
          <a key={row.id} className="ledger-row" href={`/r/${row.id}`}>
            <span>{row.title}</span>
            <span className="nums">{row.outcome}</span>
          </a>
        ))}
      </div>

      {q ? (
        <>
          <h2 className="display-s mt-4">The open question</h2>
          <p>{q.title}</p>
          <p className="muted">{q.body}</p>
          <div className="chips">
            {(["kept", "voided", "broke"] as const).map((c) => (
              <button key={c} type="button" className="chip" disabled={q.voted} onClick={() => void api.voteQuestion(c).then((v) => setQ({ ...q, votes: v.votes, voted: true }))}>
                {c} · {q.votes[c]}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <h2 className="display-s mt-4">Challenge someone</h2>
      <p className="muted">They accept or decline. You cannot impose it.</p>
      <input className="field" placeholder="their@email" value={chalEmail} onChange={(e) => setChalEmail(e.target.value)} aria-label="Their email" />
      <input className="field" placeholder="Gym by 6:30 tomorrow" value={chalText} onChange={(e) => setChalText(e.target.value)} aria-label="The commitment" />
      <button
        type="button"
        className="ghost mt-3"
        disabled={!chalEmail.includes("@") || chalText.length < 8}
        onClick={() => void api.proposeChallenge(chalEmail, chalText).then(() => api.challenges()).then(setChallenges)}
      >
        Propose. Don't lock.
      </button>
      {challenges.map((c) => (
        <article key={c.id} className="paper doc doc-flat">
          <p className="muted">{c.from} → {c.to}</p>
          <p>{c.utterance}</p>
          {c.state === "pending" && c.toUserId === me.id ? (
            <div className="stack">
              <button type="button" className="solid" onClick={() => void api.acceptChallenge(c.id)}>Accept</button>
              <button type="button" className="ghost block" onClick={() => void api.declineChallenge(c.id)}>Decline</button>
            </div>
          ) : (
            <p className="muted">{c.state}</p>
          )}
        </article>
      ))}

      <h2 className="display-s mt-4">Coach</h2>
      <p>{coach?.insight.text ?? "One sentence. Lock it."}</p>
      {!coach?.mayRaiseStake ? <p className="ok">It will never suggest raising a stake within 24 hours of a failure.</p> : null}

      <button type="button" className="ghost mt-4" onClick={() => void api.freeze().then((r) => setNote(r.ok ? `Streak holds. ${r.freezesLeft} freeze${r.freezesLeft === 1 ? "" : "s"} left.` : r.reason ?? ""))}>
        Freeze the streak
      </button>
      {note ? <p className="ok" role="status">{note}</p> : null}

      <h2 className="display-s mt-4">Self-exclusion</h2>
      <p className="muted">Blocks every stake path. Cannot be reversed early.</p>
      <button type="button" className="ghost block" onClick={() => void api.exclude(90).then((r) => setNote(`Closed until ${r.excludedUntil.slice(0, 10)}.`))}>
        Close the book for 90 days
      </button>
      {me.excludedUntil ? <p className="status status-err">Self-excluded until {me.excludedUntil.slice(0, 10)}</p> : null}

      <button type="button" className="ghost block mt-3" onClick={onSignOut}>Sign out</button>
      <a className="ghost block mt-3 center" href="/ops">Ops</a>
    </section>
  );
}

export function GroupsScreen({ api }: { api: ReturnType<typeof createBrowserApi> }) {
  const [groups, setGroups] = useState<GroupRow[] | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  useEffect(() => {
    void api.groups().then(setGroups).catch(() => setGroups([]));
  }, [api]);

  return (
    <section>
      <h1 className="display">Three to eight people.</h1>
      <p className="muted">Everyone sets their own target. Forfeits go to charity, never the pot, never the winners.</p>
      <input className="field" placeholder="Studio crew" value={name} onChange={(e) => setName(e.target.value)} aria-label="Group name" />
      <button
        type="button"
        className="ghost mt-3"
        disabled={!name.trim()}
        onClick={() => void api.createGroup(name).then(() => api.groups()).then(setGroups)}
      >
        Start a group
      </button>
      {groups === null ? <p className="muted mt-3">Looking for the room.</p> : null}
      {groups && groups.length === 0 ? <p className="muted mt-3">No room yet. The first name starts it.</p> : null}
      {groups?.map((g) => (
        <article key={g.id} className="paper doc doc-flat">
          <h2>{g.name}</h2>
          <p>{g.memberIds.length} of 8 · charity, not winners</p>
          <input className="field" placeholder="Your target" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Your target" />
          <button type="button" className="match" onClick={() => void api.groupTarget(g.id, target)}>
            Set mine
          </button>
        </article>
      ))}
    </section>
  );
}
