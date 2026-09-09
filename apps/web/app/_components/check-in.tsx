"use client";

import { useEffect, useState } from "react";
import type { CheckIn } from "@cinch/api-client";
import { createBrowserApi } from "../../lib/api";

const MOODS: Array<{ id: CheckIn["mood"]; label: string }> = [
  { id: "locked-in", label: "Locked in" },
  { id: "steady", label: "Steady" },
  { id: "struggling", label: "Struggling" },
];

export function CheckInCard({
  api,
  about,
}: {
  api: ReturnType<typeof createBrowserApi>;
  about?: string;
}) {
  const [rows, setRows] = useState<CheckIn[] | null>(null);
  const [busy, setBusy] = useState(false);
  const today = new Date().toLocaleDateString("en-CA");
  const done = rows?.find((row) => row.localDate === today);

  useEffect(() => {
    void api.checkins().then(setRows).catch(() => setRows([]));
  }, [api]);

  if (rows === null || !about) return null;

  async function log(mood: CheckIn["mood"]) {
    setBusy(true);
    try {
      const row = await api.createCheckIn({
        localDate: today,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        mood,
        note: about,
      });
      setRows((current) => [row, ...(current ?? []).filter((item) => item.localDate !== today)]);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const label = MOODS.find((item) => item.id === done.mood)?.label ?? "Logged";
    return <p className="ok">{label} on {about}. Private.</p>;
  }

  return (
    <div className="checkin-slim">
      <p className="muted">How's {about} looking?</p>
      <div className="moods slim">
        {MOODS.map((item) => (
          <button key={item.id} type="button" className="mood" disabled={busy} onClick={() => void log(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
