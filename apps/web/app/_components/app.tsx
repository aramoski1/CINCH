"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuthSession, SessionUser } from "@cinch/api-client";
import { isUnauthorized } from "@cinch/api-client";
import { createBrowserApi } from "../../lib/api";
import { clearSession, loadSession, saveSession } from "../../lib/session";
import { loadOnboarded, persistHaptics, saveOnboarded } from "../../lib/prefs";
import { thud } from "../../lib/format";
import { CreateScreen } from "./create-screen";
import { HomeScreen } from "./home-screen";
import { YouScreen } from "./you-screen";

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

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, [api]);

  function flash(label: string) {
    window.setTimeout(() => thud(), 80);
    setStamp(label);
    window.setTimeout(() => setStamp(null), 900);
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
            <p className="muted">Cinch</p>
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
                {name === "new" ? "Promise" : name === "you" ? "You" : "Now"}
              </button>
            ))}
          </nav>
        ) : null}
      </div>
      {stamp ? (
        <div className="flash" role="status" aria-live="assertive">
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
      onSession(await api.verifyEmail({ email, code, displayName: name || undefined }));
    } catch {
      setErr("That code didn't match.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <p className="eyebrow">Cinch</p>
      {stage === "email" ? (
        <>
          <h1 className="hero">Tell a friend. Put something on it.</h1>
          <p className="lede">
            {expired
              ? "Sign in again. The last session ended when the server restarted."
              : inviteCode
                ? "Someone asked you to hold them to a promise. Sign in only if you need to."
                : "You make a promise. They watch. If you flake, you pay."}
          </p>
          <ol className="steps tight">
            <li>
              <strong>Promise</strong>
              <span>Name who holds you to it.</span>
            </li>
            <li>
              <strong>Lock</strong>
              <span>Points on the line. Not money.</span>
            </li>
            <li>
              <strong>Settle</strong>
              <span>You did it, or they get the points.</span>
            </li>
          </ol>
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
            {busy ? "Sending" : "Send a code"}
          </button>
          <p className="muted center mt-4">Points only. The house never takes a cut.</p>
        </>
      ) : (
        <>
          <h1 className="hero">Six digits.</h1>
          {devCode ? <p className="ok nums otp">{devCode}</p> : <p className="muted">Check your email.</p>}
          <label className="sr-only" htmlFor="otp">Code</label>
          <input
            id="otp"
            className="field mt-3"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <label className="sr-only" htmlFor="name">Name</label>
          <input id="name" className="field mt-3" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          {err ? <p className="status status-err" role="alert">{err}</p> : null}
          <button type="button" className="btn btn-lock mt-4" disabled={busy || code.length !== 6} onClick={() => void verify()}>
            Continue
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
    { title: "Photo or you lose.", body: "Beat the clock with proof. Miss the picture and they get the points." },
    { title: "That's the whole product.", body: "Say it. Lock it. Prove it. The board ranks who actually shows up." },
  ];
  const slide = slides[step]!;
  return (
    <section className="empty">
      <p className="eyebrow">Cinch</p>
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
