"use client";

import { useEffect, useState } from "react";
import type {
  Achievement,
  DiscoverPerson,
  FriendsList,
  GroupRow,
  Leaderboard,
  PersonProfile,
} from "@cinch/api-client";
import { createBrowserApi } from "../../lib/api";
import { formatStake, initials } from "../../lib/format";
import { face } from "./brand";

type Hub = "board" | "network" | "challenges" | "badges" | "squads" | "play";

export function CommunityHub({
  api,
  board,
  friends,
  protocols,
  standing,
  question,
  onQuestion,
  onCompose,
  onFlash,
}: {
  api: ReturnType<typeof createBrowserApi>;
  board: Leaderboard | null;
  friends: FriendsList;
  protocols: Array<{ id: string; name: string; utterance: string; why: string }>;
  standing: { id: string; title: string; count: number } | null;
  question: Awaited<ReturnType<typeof api.openQuestion>> | null;
  onQuestion: (next: Awaited<ReturnType<typeof api.openQuestion>>) => void;
  onCompose: () => void;
  onFlash: (label: string) => void;
}) {
  const [hub, setHub] = useState<Hub>("board");
  const [friendId, setFriendId] = useState<string | null>(null);
  const [challengeEmail, setChallengeEmail] = useState("");

  if (friendId) {
    return (
      <FriendPane
        api={api}
        id={friendId}
        onBack={() => setFriendId(null)}
        onFlash={onFlash}
        onChallenge={(email) => {
          setFriendId(null);
          setChallengeEmail(email);
          setHub("challenges");
        }}
      />
    );
  }

  return (
    <div>
      <p className="eyebrow">Multiplayer</p>
      <h2 className="hero-s">People who notice</h2>
      <div className="filters">
        {(
          [
            ["board", "Board"],
            ["network", "Network"],
            ["challenges", "Challenges"],
            ["badges", "Badges"],
            ["squads", "Squads"],
            ["play", "Play"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={hub === id ? "chip on" : "chip"} onClick={() => setHub(id)}>
            {label}
          </button>
        ))}
      </div>
      {hub === "board" ? <BoardPane board={board} onOpen={setFriendId} /> : null}
      {hub === "network" ? (
        <NetworkPane api={api} friends={friends} onOpen={setFriendId} onFlash={onFlash} />
      ) : null}
      {hub === "challenges" ? (
        <ChallengesPane api={api} seedEmail={challengeEmail} onFlash={onFlash} onCompose={onCompose} />
      ) : null}
      {hub === "badges" ? <BadgesPane api={api} /> : null}
      {hub === "squads" ? <SquadsPane api={api} onFlash={onFlash} /> : null}
      {hub === "play" ? (
        <PlayPane
          api={api}
          protocols={protocols}
          standing={standing}
          question={question}
          onQuestion={onQuestion}
          onCompose={onCompose}
          onFlash={onFlash}
        />
      ) : null}
    </div>
  );
}

function BoardPane({
  board,
  onOpen,
}: {
  board: Leaderboard | null;
  onOpen: (id: string) => void;
}) {
  if (!board || board.board.length < 2) {
    return <p className="muted mt-3">Add a friend and the board lights up. Ranked by keep rate, then streak.</p>;
  }
  return (
    <ol className="board">
      {board.board.map((row) => (
        <li key={row.id} className={row.you ? "you" : ""}>
          <button type="button" className="board-link" onClick={() => !row.you && onOpen(row.id)}>
            <span className="medal" aria-hidden="true">
              {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : ""}
            </span>
            <span className="nums rank">{row.rank}</span>
            <div className="avatar sm" style={{ background: face(row.displayName) }}>
              {initials(row.displayName)}
            </div>
            <span>
              {row.displayName}
              {row.you ? " · you" : ""}
            </span>
            <span className="nums muted">
              {row.rate}% · {row.streak} streak
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function NetworkPane({
  api,
  friends,
  onOpen,
  onFlash,
}: {
  api: ReturnType<typeof createBrowserApi>;
  friends: FriendsList;
  onOpen: (id: string) => void;
  onFlash: (label: string) => void;
}) {
  const [tab, setTab] = useState<"friends" | "discover">("friends");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<DiscoverPerson[]>([]);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (tab !== "discover") return;
    const id = window.setTimeout(() => {
      void api.people(q).then(setFound).catch(() => setFound([]));
    }, 200);
    return () => window.clearTimeout(id);
  }, [api, q, tab]);

  return (
    <div>
      <div className="filters">
        <button type="button" className={tab === "friends" ? "chip on" : "chip"} onClick={() => setTab("friends")}>
          Friends
        </button>
        <button type="button" className={tab === "discover" ? "chip on" : "chip"} onClick={() => setTab("discover")}>
          Discover
        </button>
      </div>
      {tab === "friends" ? (
        friends.people.length === 0 && friends.named.length === 0 ? (
          <p className="muted mt-3">No one in the circle yet. Add them by email.</p>
        ) : (
          <div className="people mt-3">
            {friends.people.map((p) => (
              <button key={p.id} type="button" className="person-card" onClick={() => onOpen(p.id)}>
                <div className="avatar" style={{ background: face(p.displayName) }}>{initials(p.displayName)}</div>
                <span>{p.displayName}</span>
                <small>On Cinch</small>
              </button>
            ))}
            {friends.named.map((n) => (
              <div key={n} className="person-card">
                <div className="avatar" style={{ background: face(n) }}>{initials(n)}</div>
                <span>{n}</span>
                <small>Invite only</small>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <input className="field mt-3" placeholder="Search a name or email" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="people mt-3">
            {found.map((p) => (
              <button key={p.id} type="button" className="person-card" onClick={() => onOpen(p.id)}>
                <div className="avatar" style={{ background: face(p.displayName) }}>{initials(p.displayName)}</div>
                <span>{p.displayName}</span>
                <small>{p.relationship === "friend" ? "Already in" : `${p.rate ?? 0}% kept`}</small>
              </button>
            ))}
          </div>
        </>
      )}
      <p className="eyebrow mt-4">Add by email</p>
      <input className="field" type="email" placeholder="friend@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button
        type="button"
        className="btn btn-ghost mt-3"
        disabled={!email.includes("@")}
        onClick={() =>
          void api
            .addFriend(email.trim())
            .then(() => {
              setEmail("");
              onFlash("Added");
            })
            .catch((e) => onFlash(e instanceof Error ? e.message : "Couldn't add them"))
        }
      >
        Add to network
      </button>
    </div>
  );
}

function ChallengesPane({
  api,
  seedEmail,
  onFlash,
  onCompose,
}: {
  api: ReturnType<typeof createBrowserApi>;
  seedEmail?: string;
  onFlash: (label: string) => void;
  onCompose: () => void;
}) {
  const [rows, setRows] = useState<Array<{ id: string; utterance: string; state: string; from?: string; to?: string; incoming?: boolean }>>([]);
  const [email, setEmail] = useState(seedEmail ?? "");
  const [utterance, setUtterance] = useState("");

  async function load() {
    setRows(await api.challenges());
  }

  useEffect(() => {
    void load().catch(() => setRows([]));
  }, [api]);

  useEffect(() => {
    if (seedEmail) setEmail(seedEmail);
  }, [seedEmail]);

  return (
    <div>
      <p className="muted mt-3">Challenge a friend to the same shape. They accept, it locks on their side.</p>
      {rows.length === 0 ? <p className="muted">No challenges yet. Be the first.</p> : null}
      {rows.map((row) => (
        <article key={row.id} className="bet mt-3">
          <p className="eyebrow">{row.state}</p>
          <h3 className="watch-title">{row.utterance}</h3>
          <p className="muted">{row.incoming ? `${row.from} challenged you` : `Waiting on ${row.to}`}</p>
          {row.state === "pending" && row.incoming ? (
            <div className="row-actions">
              <button
                type="button"
                className="text-btn"
                onClick={() => void api.acceptChallenge(row.id).then(() => { onFlash("Accepted"); void load(); onCompose(); })}
              >
                Accept
              </button>
              <button type="button" className="text-btn" onClick={() => void api.declineChallenge(row.id).then(() => { onFlash("Declined"); void load(); })}>
                Decline
              </button>
            </div>
          ) : null}
        </article>
      ))}
      <p className="eyebrow mt-4">New challenge</p>
      <input className="field" type="email" placeholder="their@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <textarea className="area mt-3" placeholder="Gym tomorrow at 6:30" value={utterance} onChange={(e) => setUtterance(e.target.value)} />
      <button
        type="button"
        className="btn btn-lock mt-3"
        disabled={!email.includes("@") || utterance.trim().length < 8}
        onClick={() =>
          void api.proposeChallenge(email.trim(), utterance.trim()).then(() => {
            setUtterance("");
            onFlash("Sent");
            void load();
          }).catch((e) => onFlash(e instanceof Error ? e.message : "Couldn't send"))
        }
      >
        Send challenge
      </button>
    </div>
  );
}

function BadgesPane({ api }: { api: ReturnType<typeof createBrowserApi> }) {
  const [rows, setRows] = useState<Achievement[]>([]);
  useEffect(() => {
    void api.achievements().then(setRows).catch(() => setRows([]));
  }, [api]);
  return (
    <div className="badges mt-3">
      {[...rows].sort((a, b) => Number(b.unlocked) - Number(a.unlocked)).map((row) => (
        <article key={row.id} className={row.unlocked ? "badge-card on" : "badge-card"}>
          <strong>{row.title}</strong>
          <p className="muted">{row.description}</p>
          {row.unlocked ? (
            <span className="win-stat">Unlocked</span>
          ) : (
            <>
              <div className="xp-bar" aria-hidden="true">
                <i style={{ width: `${Math.min(100, (row.progress / row.target) * 100)}%` }} />
              </div>
              <p className="muted">{Math.min(row.progress, row.target)} / {row.target}</p>
            </>
          )}
        </article>
      ))}
    </div>
  );
}

function SquadsPane({
  api,
  onFlash,
}: {
  api: ReturnType<typeof createBrowserApi>;
  onFlash: (label: string) => void;
}) {
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    setRows(await api.groups());
  }

  useEffect(() => {
    void load().catch(() => setRows([]));
  }, [api]);

  return (
    <div>
      <p className="muted mt-3">A squad is 2–8 people. Same room, same week.</p>
      {rows.length === 0 ? <p className="muted">No squads yet.</p> : null}
      {rows.map((row) => (
        <article key={row.id} className="bet mt-3">
          <h3 className="watch-title">{row.name}</h3>
          <p className="muted">{row.memberIds.length} members</p>
          <button type="button" className="text-btn" onClick={() => setOpen(row.id)}>
            Open
          </button>
          {open === row.id ? (
            <>
              <input className="field mt-3" placeholder="This week's target" value={target} onChange={(e) => setTarget(e.target.value)} />
              <button
                type="button"
                className="btn btn-ghost mt-3"
                disabled={!target.trim()}
                onClick={() => void api.groupTarget(row.id, target.trim()).then(() => onFlash("Target set"))}
              >
                Set my target
              </button>
            </>
          ) : null}
        </article>
      ))}
      <p className="eyebrow mt-4">New squad</p>
      <input className="field" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <button
        type="button"
        className="btn btn-lock mt-3"
        disabled={!name.trim()}
        onClick={() =>
          void api.createGroup(name.trim()).then(() => {
            setName("");
            onFlash("Squad up");
            void load();
          })
        }
      >
        Create squad
      </button>
    </div>
  );
}

function FriendPane({
  api,
  id,
  onBack,
  onFlash,
  onChallenge,
}: {
  api: ReturnType<typeof createBrowserApi>;
  id: string;
  onBack: () => void;
  onFlash: (label: string) => void;
  onChallenge: (email: string) => void;
}) {
  const [profile, setProfile] = useState<PersonProfile | null>(null);
  useEffect(() => {
    void api.person(id).then(setProfile).catch(() => setProfile(null));
  }, [api, id]);
  if (!profile) return <p className="muted">Loading…</p>;
  const { person } = profile;
  return (
    <div>
      <button type="button" className="text-btn" onClick={onBack}>
        Back to community
      </button>
      <div className="you-head mt-3">
        <div className="avatar avatar-lg" style={{ background: face(person.displayName) }}>
          {initials(person.displayName)}
        </div>
        <div>
          <p className="eyebrow">{person.relationship === "friend" ? "Friend" : "On Cinch"}</p>
          <h2 className="hero-s">{person.displayName}</h2>
          <p className="muted">{person.streak} streak · {formatStake(person.score)} score</p>
        </div>
      </div>
      <dl className="meta-list">
        <div>
          <dt>Shared promises</dt>
          <dd>{profile.sharedCommitments}</dd>
        </div>
        <div>
          <dt>Kept together</dt>
          <dd>{profile.keptTogether}</dd>
        </div>
        <div>
          <dt>Mutual friends</dt>
          <dd>{profile.mutualFriends}</dd>
        </div>
      </dl>
      <p className="eyebrow">Recent badges</p>
      {profile.achievements.length === 0 ? <p className="muted">No badges yet.</p> : null}
      {profile.achievements.slice(0, 4).map((a) => (
        <p key={a.id}>
          <strong>{a.title}</strong>
          <span className="muted"> — {a.description}</span>
        </p>
      ))}
      <button type="button" className="btn btn-lock mt-4" onClick={() => onChallenge(person.email)}>
        Challenge them
      </button>
      {person.relationship === "friend" ? (
        <button
          type="button"
          className="btn btn-ghost mt-3"
          onClick={() => void api.removeFriend(person.id).then(() => { onFlash("Removed"); onBack(); })}
        >
          Remove
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-ghost mt-3"
          onClick={() => void api.addFriend(person.email).then(() => { onFlash("Added"); void api.person(id).then(setProfile); })}
        >
          Add friend
        </button>
      )}
    </div>
  );
}

function PlayPane({
  api,
  protocols,
  standing,
  question,
  onQuestion,
  onCompose,
  onFlash,
}: {
  api: ReturnType<typeof createBrowserApi>;
  protocols: Array<{ id: string; name: string; utterance: string; why: string }>;
  standing: { id: string; title: string; count: number } | null;
  question: Awaited<ReturnType<typeof api.openQuestion>> | null;
  onQuestion: (next: Awaited<ReturnType<typeof api.openQuestion>>) => void;
  onCompose: () => void;
  onFlash: (label: string) => void;
}) {
  return (
    <div>
      <p className="muted mt-3">Proven shapes and a live call. None of this is loot.</p>
      {protocols.map((p) => (
        <article key={p.id} className="bet mt-3">
          <h3 className="watch-title">{p.name}</h3>
          <p className="muted">{p.why}</p>
          <button
            type="button"
            className="text-btn"
            onClick={() => void api.adoptProtocol(p.id).then(() => { onFlash("Taken on"); onCompose(); })}
          >
            Take this on
          </button>
        </article>
      ))}
      {standing ? (
        <article className="bet mt-3">
          <p className="eyebrow">Standing</p>
          <h3 className="watch-title">{standing.title}</h3>
          <p className="muted">{standing.count} completions. It can run itself.</p>
          <button type="button" className="text-btn" onClick={() => void api.makeStanding().then(() => onFlash("Standing"))}>
            Run it again
          </button>
        </article>
      ) : null}
      {question ? (
        <article className="bet mt-3">
          <p className="eyebrow">Open question</p>
          <h3 className="watch-title">{question.title}</h3>
          <p className="muted">{question.body}</p>
          {question.voted ? (
            <p className="ok">Kept {question.votes.kept} · Voided {question.votes.voided} · Broke {question.votes.broke}</p>
          ) : (
            <div className="row-actions">
              {(["kept", "voided", "broke"] as const).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className="text-btn"
                  onClick={() => void api.voteQuestion(choice).then((r) => onQuestion({ ...question, voted: true, votes: r.votes }))}
                >
                  {choice}
                </button>
              ))}
            </div>
          )}
        </article>
      ) : null}
    </div>
  );
}
