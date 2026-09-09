"use client";

import { useEffect, useRef, useState } from "react";
import { snapFromVideo } from "../../lib/photo";

export function ProofCamera({
  title,
  onCapture,
  onClose,
  onLibrary,
}: {
  title: string;
  onCapture: (preview: string) => void;
  onClose: () => void;
  onLibrary: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        setReady(true);
      } catch {
        if (!cancelled) setErr("Camera isn't available. Use a photo from the library.");
      }
    }
    void start();
    return () => {
      cancelled = true;
      for (const track of streamRef.current?.getTracks() ?? []) track.stop();
      streamRef.current = null;
    };
  }, []);

  function snap() {
    const video = videoRef.current;
    if (!video || !ready) return;
    try {
      onCapture(snapFromVideo(video));
    } catch {
      setErr("Couldn't take that photo.");
    }
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Take proof">
      <div className="sheet camera-sheet">
        <p className="eyebrow">Proof</p>
        <h2>{title}</h2>
        <div className="camera-stage">
          <video ref={videoRef} playsInline muted autoPlay />
          {!ready && !err ? <p className="camera-wait">Opening camera…</p> : null}
        </div>
        {err ? <p className="status status-err" role="alert">{err}</p> : null}
        <p className="muted">Show the thing happening. Screenshots and old stills won't count.</p>
        <div className="stack mt-4">
          <button type="button" className="btn btn-lock" disabled={!ready} onClick={snap}>
            Take photo
          </button>
          <button type="button" className="btn btn-ghost" onClick={onLibrary}>
            Choose from library
          </button>
          <button type="button" className="text-btn center" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
