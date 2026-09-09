"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuthSession, SessionUser } from "@cinch/api-client";
import { isUnauthorized } from "@cinch/api-client";
import { createBrowserApi } from "../../lib/api";
import { hasAuthLink, readAuthLink, stripAuthLink } from "../../lib/auth-link";
import { clearSession, loadSession, saveSession } from "../../lib/session";
import { loadOnboarded, persistHaptics, saveOnboarded } from "../../lib/prefs";
import { thud } from "../../lib/format";
import { CreateScreen } from "./create-screen";
import { HomeScreen } from "./home-screen";
import { YouScreen } from "./you-screen";
import { Wordmark } from "./brand";

type Tab = "home" | "new" | "you";

export function CinchApp() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [stamp, setStamp] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [onboarded, setOnboarded] = useState(true);
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [unread, setUnread] = useState(0);
  const api = useMemo(
    () =>
      createBrowserApi(() => {
        clearSession();
        setExpired(true);
        setSession(null);
        setTab("home");
      }),
    [],
  );

  useEffect(() => {
    setOnboarded(loadOnboarded());
    setInviteCode(new URLSearchParams(window.location.search).get("invite"));
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);

    const link = readAuthLink(window.location);
    if (hasAuthLink(link)) {
      void api
        .completeEmailLink({
          accessToken: link.accessToken,
          tokenHash: link.tokenHash,
          type: link.type,
        })
        .then((next) => {
          saveSession(next);
          persistHaptics(next.user.settings?.haptics ?? true);
          setExpired(false);
          setSession(next);
        })
        .catch(() => setExpired(true))
        .finally(() => {
          stripAuthLink();
          setReady(true);
        });
    } else if (link.error) {
      setExpired(true);
      stripAuthLink();
      setReady(true);
    } else {
      const current = loadSession();
      persistHaptics(current?.user.settings?.haptics ?? true);
      if (!current) {
        setReady(true);
      } else {
        void api
          .me()
          .then((m) => {
            const merged = { ...current, user: { ...current.user, ...m.user } };
            saveSession(merged);
            persistHaptics(merged.user.settings?.haptics ?? true);
            setSession(merged);
          })
          .catch((error) => {
            if (isUnauthorized(error)) {
              clearSession();
              setExpired(true);
              setSession(null);
              return;
            }
            setSession(current);
          })
          .finally(() => setReady(true));
      }
    }

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, [api]);

  useEffect(() => {
    if (!session) {
      setUnread(0);
      return;
    }
    void api.notifications().then((notes) => setUnread(notes.length)).catch(() => undefined);
  }, [api, session, tab]);

  function flash(label: string) {
    window.setTimeout(() => thud(), 80);
    setStamp(label);
    window.setTimeout(() => setStamp(null), 1100);
  }

  function updateUser(next: SessionUser) {
    setSession((current) => {
      if (!current) return current;
      const merged = { ...current, user: { ...current.user, ...next } };
      saveSession(merged);
      return merged;
    });
  }

  return (
    <div className="app">
      <div className="phone">
        <div className="screen">
          {!online ? <p className="banner" role="status">You're offline. The promise still stands.</p> : null}
          {!ready ? (
            <Wordmark />
          ) : !session ? (
            <AuthScreen
              inviteCode={inviteCode}
              expired={expired}
              onSession={(next) => {
                saveSession(next);
                persistHaptics(next.user.settings?.haptics ?? true);
                setExpired(false);
                setSession(next);
              }}
            />
          ) : !onboarded ? (
            <Onboard
              name={session.user.displayName}
              onDone={() => {
                saveOnboarded();
                setOnboarded(true);
              }}
            />
          ) : (
            <>
              {tab === "home" ? (
                <HomeScreen
                  api={api}
                  session={session}
                  inviteCode={inviteCode}
                  onCompose={() => setTab("new")}
                  onFlash={flash}
                />
              ) : null}
              {tab === "new" ? (
                <CreateScreen
                  api={api}
                  online={online}
                  onLocked={() => {
                    flash("Locked");
                    setTab("home");
                  }}
                />
              ) : null}
              {tab === "you" ? (
                <YouScreen
                  api={api}
                  session={session}
                  onCompose={() => setTab("new")}
                  onFlash={flash}
                  onUser={updateUser}
                  onSignOut={() => {
                    clearSession();
                    setSession(null);
                    setUnread(0);
                    setTab("home");
                  }}
                />
              ) : null}
            </>
          )}
        </div>
        {session && onboarded ? (
          <nav className="tabs" aria-label="Main">
            {(["home", "new", "you"] as const).map((name) => (
              <button
                key={name}
                type="button"
                className={tab === name ? "on" : ""}
                aria-current={tab === name ? "page" : undefined}
                onClick={() => setTab(name)}
              >
                {name === "home" ? (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M12 8v4l2.5 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                ) : null}
                {name === "new" ? (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M7 12h10M12 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : null}
                {name === "you" ? (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M6 19c1.2-3 3.3-4.5 6-4.5S16.8 16 18 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                ) : null}
                {name === "you" && unread > 0 ? <span className="tab-badge">{unread > 9 ? "9+" : unread}</span> : null}
                {name === "new" ? "Promise" : name === "you" ? "You" : "Now"}
              </button>
            ))}
          </nav>
        ) : null}
      </div>
      {stamp ? (
        <div className="flash" role="status" aria-live="assertive">
          <div className="burst" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <div className="stamp">{stamp}</div>
        </div>
      ) : null}
    </div>
  );
}

function AuthScreen({
  onSession,
  inviteCode,
  expired,
}: {
  onSession: (session: AuthSession) => void;
  inviteCode: string | null;
  expired: boolean;
}) {
  const api = useMemo(() => createBrowserApi(), []);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [stage, setStage] = useState<"email" | "otp">("email");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setErr("");
    setBusy(true);
    try {
      const res = await api.requestEmailCode(email);
      if (res.throttled) return setErr("Wait a minute, then try again.");
      setDevCode(res.devCode ?? null);
      setReturning(Boolean(res.exists));
      setStage("otp");
    } catch {
      setErr("Can't reach Cinch.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setErr("");
    setBusy(true);
    try {
      onSession(
        await api.verifyEmail({
          email,
          code,
          displayName: returning ? undefined : name || undefined,
        }),
      );
    } catch {
      setErr("That code didn't match. Request a new email and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <Wordmark size={52} />
      {stage === "email" ? (
        <>
          <h1 className="hero">
            {expired ? (
              <>
                Welcome back.<br /><em>Sign in to keep going.</em>
              </>
            ) : (
              <>
                Make it real,<br /><em>then make it happen.</em>
              </>
            )}
          </h1>
          <p className="lede">
            {expired
              ? "Same email as last time. We'll send a link so you land back in your account."
              : inviteCode
                ? "Someone asked you to hold them to a promise. Sign in only if you need to."
                : "Sign in with your email. New here? That first link creates your account. Coming back? Same step, same account."}
          </p>
          <div className="pitch">
            <article>
              <strong>Lock it</strong>
              <span>One sentence. Dollars on the line — play money, nobody is charged.</span>
            </article>
            <article>
              <strong>Involve a friend</strong>
              <span>Pick someone from your network. Accountability needs a face.</span>
            </article>
            <article>
              <strong>Prove it</strong>
              <span>Photo before the clock hits zero. Miss it and they collect the dollars.</span>
            </article>
          </div>
          <label className="sr-only" htmlFor="email">Email</label>
          <input
            id="email"
            className="field"
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {err ? <p className="status status-err" role="alert">{err}</p> : null}
          <button type="button" className="btn btn-lock mt-4" disabled={busy || !email.includes("@")} onClick={() => void send()}>
            {busy ? "Sending" : "Sign in"}
          </button>
          <p className="muted center mt-4">No password. We email you a link each time.</p>
        </>
      ) : (
        <>
          <h1 className="hero">{returning ? "Welcome back." : "Check your email."}</h1>
          {devCode ? (
            <p className="ok nums otp">{devCode}</p>
          ) : (
            <p className="muted">
              {returning
                ? "Open the link on this phone to get back in. If the email has a code, you can type that instead."
                : "Open the link on this phone to create your account. If the email has a code, you can type that instead."}
            </p>
          )}
          <label className="sr-only" htmlFor="otp">Code</label>
          <input
            id="otp"
            className="field mt-3"
            inputMode="numeric"
            maxLength={8}
            autoComplete="one-time-code"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
          />
          {returning ? null : (
            <>
              <label className="sr-only" htmlFor="name">Name</label>
              <input id="name" className="field mt-3" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            </>
          )}
          {err ? <p className="status status-err" role="alert">{err}</p> : null}
          <button type="button" className="btn btn-lock mt-4" disabled={busy || code.length < 6} onClick={() => void verify()}>
            {busy ? "Checking" : returning ? "Sign in" : "Create account"}
          </button>
          <button
            type="button"
            className="text-btn center mt-4"
            onClick={() => {
              setStage("email");
              setCode("");
              setDevCode(null);
              setErr("");
            }}
          >
            Use a different email
          </button>
        </>
      )}
    </section>
  );
}

function Onboard({ name, onDone }: { name: string; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const slides = [
    { title: `${name.split(" ")[0]}, a friend holds you to it.`, body: "Pick them from your network. They're the only audience." },
    { title: "Photo or you lose.", body: "Beat the clock with proof. Miss the picture and they collect the dollars." },
    { title: "That's the whole product.", body: "Say it. Lock it. Prove it. The board ranks who actually shows up." },
  ];
  const slide = slides[step]!;
  return (
    <section className="empty">
      <Wordmark />
      <h1 className="hero">{slide.title}</h1>
      <p className="lede">{slide.body}</p>
      <div className="dots" aria-hidden="true">
        {slides.map((_, i) => (
          <i key={i} className={i === step ? "on" : ""} />
        ))}
      </div>
      <button
        type="button"
        className="btn btn-lock"
        onClick={() => {
          if (step < slides.length - 1) setStep(step + 1);
          else onDone();
        }}
      >
        {step < slides.length - 1 ? "Next" : "Let's go"}
      </button>
    </section>
  );
}
