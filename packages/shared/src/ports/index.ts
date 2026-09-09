import type { Amount } from "../amount";

export type NotificationChannel = "push" | "sms" | "email" | "in_app";

export type NotificationTemplate =
  | "invite_received"
  | "invite_accepted"
  | "invite_declined"
  | "invite_expired"
  | "commitment_locked"
  | "hour_remaining"
  | "leave_by_now"
  | "evidence_requested"
  | "partner_attest_requested"
  | "commitment_succeeded"
  | "commitment_failed"
  | "dispute_opened"
  | "coach_nudge";

export interface Notifier {
  send(input: {
    userId: string;
    channel: NotificationChannel;
    template: NotificationTemplate;
    data: Record<string, unknown>;
  }): Promise<{ delivered: boolean; providerId?: string }>;
}

export type ForfeitDestination = "partner" | "charity" | "group_pool" | "platform" | "savings";

export interface StakeProvider {
  reserve(input: {
    commitmentId: string;
    userId: string;
    amount: Amount;
  }): Promise<{ reservationId: string }>;
  release(reservationId: string): Promise<void>;
  forfeit(reservationId: string, destination: ForfeitDestination): Promise<void>;
}

export type LatLng = { lat: number; lng: number };

export type Place = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  source: "seeded" | "captured" | "google";
};

export interface PlaceProvider {
  search(q: string, near?: LatLng): Promise<Place[]>;
  byId(id: string): Promise<Place | null>;
}

export interface Queue {
  schedule(
    name: string,
    payload: unknown,
    runAt: Date,
    opts?: { key?: string },
  ): Promise<string>;
  cancel(jobId: string): Promise<void>;
}

export interface Analytics {
  track(
    userId: string | null,
    event: string,
    props?: Record<string, unknown>,
  ): Promise<void>;
}

export interface ErrorReporter {
  capture(input: {
    level: "debug" | "info" | "warn" | "error";
    message: string;
    context?: Record<string, unknown>;
  }): Promise<void>;
}

export interface FlagProvider {
  enabled(key: string, userId?: string): Promise<boolean>;
}

export type LlmToolCall = {
  name: string;
  input: Record<string, unknown>;
};

export interface EmailOtp {
  send(email: string, redirectTo?: string): Promise<{ delivered: boolean }>;
  verify(email: string, code: string): Promise<boolean>;
  consumeLink(input: {
    accessToken?: string;
    tokenHash?: string;
    type?: string;
  }): Promise<{ email: string; displayName?: string } | null>;
}

export interface RuntimeSnapshot {
  load(): Promise<Record<string, unknown> | null>;
  save(payload: Record<string, unknown>): Promise<void>;
}

export interface LanguageModel {
  complete(input: {
    system: string;
    user: string;
    maxTokens: number;
    timeoutMs: number;
    tools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
  }): Promise<{ text: string; toolCalls: LlmToolCall[] }>;
  reviewImage(input: {
    mediaType: "image/jpeg" | "image/png" | "image/webp";
    data: Uint8Array;
    prompt: string;
  }): Promise<{ score: number; labels: string[]; rationale: string }>;
}
