import type { CreateBetResponse } from "./betApi";

/**
 * Persistent-connection version of the create-bet-over-websocket test.
 *
 * Why this instead of betWebSocketTest.ts:
 * Opening a brand new WebSocket per bet pays a full TCP + TLS + WS
 * handshake every single time — on a mobile network that overhead can
 * be WORSE than a keep-alive HTTP request. The actual perf win from
 * websockets only shows up if you open the connection once and reuse
 * it for every bet in the session. This file does that: a module-level
 * singleton socket, request_id-based response matching, a small
 * reconnect-with-backoff loop, and a queue for calls made before the
 * socket is ready.
 */

export interface CreateBetWebSocketPayload {
  session_id: number;
  fish_type_id: number;
  cannon_type_id: number;
  elapsed_seconds: string;
}

interface BetSocketEnvelope {
  topic?: string;
  request_id?: string;
  data?: unknown;
  success?: boolean;
  message?: string;
  status_code?: number;
}

const BET_CREATE_TOPIC = "front.bet.create";
const BET_RESPONSE_TOPICS = new Set([
  "front.bet.created",
  "front.bet.create.response",
  "bet.created",
  "bets.create.response",
]);

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_RECONNECT_DELAY_MS = 8000;

type PendingEntry = {
  resolve: (value: CreateBetResponse) => void;
  reject: (reason: unknown) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

// ---- module-level singleton state (one socket for the whole app/session) ----
let socket: WebSocket | null = null;
let connectPromise: Promise<WebSocket> | null = null;
let reconnectAttempt = 0;
let manuallyClosed = false;

const pending = new Map<string, PendingEntry>();

function getBetWsUrl(): string {
  const config = useRuntimeConfig();
  const base = String(config.public.apiEndPoint || "").replace(/\/$/, "");
  const wsBase = base.replace(/^http(s?):\/\//, "ws$1://");
  return `${wsBase}/websocket/ws`;
}

function getAccessToken(): string {
  const cookieToken = useCookie<string | null>("accessToken").value;
  if (cookieToken) return cookieToken;
  if (process.client) return localStorage.getItem("accessToken") || "";
  return "";
}

function makeRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isCreateBetResponse(value: unknown): value is CreateBetResponse {
  const response = value as CreateBetResponse | undefined;
  return Boolean(response?.data?.bet);
}

function normalizeBetResponse(envelope: BetSocketEnvelope): CreateBetResponse | null {
  if (isCreateBetResponse(envelope)) return envelope;
  if (isCreateBetResponse(envelope.data)) return envelope.data;

  const data = envelope.data as { bet?: unknown } | undefined;
  if (data?.bet) {
    return {
      success: envelope.success ?? true,
      message: envelope.message ?? "ok",
      status_code: envelope.status_code ?? 200,
      data: {
        bet: data.bet as CreateBetResponse["data"]["bet"],
      },
    };
  }

  return null;
}

function handleMessage(event: MessageEvent) {
  let envelope: BetSocketEnvelope;
  try {
    envelope = JSON.parse(event.data);
  } catch {
    return; // ignore malformed frames, don't kill the whole connection over one bad message
  }

  const requestId = envelope.request_id;
  if (!requestId || !pending.has(requestId)) return;

  const hasBetTopic = !envelope.topic || BET_RESPONSE_TOPICS.has(envelope.topic);
  if (!hasBetTopic) return;

  const response = normalizeBetResponse(envelope);
  const entry = pending.get(requestId)!;
  pending.delete(requestId);
  clearTimeout(entry.timeoutId);

  if (response) {
    entry.resolve(response);
  } else {
    entry.reject(new Error(envelope.message || "Malformed bet response"));
  }
}

function rejectAllPending(reason: unknown) {
  for (const [id, entry] of pending) {
    clearTimeout(entry.timeoutId);
    entry.reject(reason);
    pending.delete(id);
  }
}

function scheduleReconnect() {
  if (manuallyClosed) return;
  const delay = Math.min(1000 * 2 ** reconnectAttempt, MAX_RECONNECT_DELAY_MS);
  reconnectAttempt += 1;
  setTimeout(() => {
    connect().catch(() => {
      // swallow here; next bet call (or the next scheduled reconnect) will retry
    });
  }, delay);
}

function connect(): Promise<WebSocket> {
  if (!process.client) {
    return Promise.reject(new Error("Bet websocket is client-only"));
  }
  if (socket && socket.readyState === WebSocket.OPEN) {
    return Promise.resolve(socket);
  }
  if (connectPromise) {
    return connectPromise;
  }

  const token = getAccessToken();
  if (!token) {
    return Promise.reject(new Error("Missing access token for bet websocket"));
  }

  manuallyClosed = false;

  connectPromise = new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(getBetWsUrl(), ["Bearer", token]);

    const onOpenTimeout = setTimeout(() => {
      ws.close();
      reject(new Error("Bet websocket connect timed out"));
    }, DEFAULT_TIMEOUT_MS);

    ws.onopen = () => {
      clearTimeout(onOpenTimeout);
      reconnectAttempt = 0;
      socket = ws;
      resolve(ws);
    };

    ws.onmessage = handleMessage;

    ws.onerror = () => {
      clearTimeout(onOpenTimeout);
      reject(new Error("Bet websocket connection failed"));
    };

    ws.onclose = () => {
      socket = null;
      connectPromise = null;
      rejectAllPending(new Error("Bet websocket connection closed"));
      scheduleReconnect();
    };
  }).finally(() => {
    // allow future reconnect attempts to create a new promise once this settles
    if (socket?.readyState !== WebSocket.OPEN) {
      connectPromise = null;
    }
  });

  return connectPromise;
}

/** Call once (e.g. when the game scene mounts) to warm the connection before the first bet. */
export function connectBetSocket(): Promise<WebSocket> {
  return connect();
}

/** Call when the game scene unmounts / session ends. */
export function closeBetSocket() {
  manuallyClosed = true;
  rejectAllPending(new Error("Bet websocket closed by client"));
  socket?.close();
  socket = null;
  connectPromise = null;
}

export async function createBetViaSocket(
  payload: CreateBetWebSocketPayload,
  options?: { timeoutMs?: number; topic?: string },
): Promise<CreateBetResponse> {
  const ws = await connect();

  const requestId = makeRequestId();
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const topic = options?.topic ?? BET_CREATE_TOPIC;

  return new Promise<CreateBetResponse>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error(`Bet websocket request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    pending.set(requestId, { resolve, reject, timeoutId });

    ws.send(JSON.stringify({ topic, request_id: requestId, data: payload }));
  });
}

/** Drop-in replacement shape for createBet(), so it's a one-line swap at call sites. */
export async function createBetRuntime(payload: CreateBetWebSocketPayload) {
  const response = await createBetViaSocket(payload);
  return { data: ref(response) };
}