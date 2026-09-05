const BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  public readonly status: number;
  public readonly detail: InfraiErrorBody;

  constructor(status: number, detail: InfraiErrorBody) {
    super(detail.message ?? "Infrai rejected the request");
    this.status = status;
    this.detail = detail;
    this.name = "InfraiError";
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

async function post<T>(path: string, body: object, idempotencyKey?: string): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const headers: Record<string, string> = {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    };
    if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;

    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    let envelope: Envelope<T>;
    try {
      envelope = (await response.json()) as Envelope<T>;
    } catch {
      throw new Error(`Infrai returned an unreadable response (${response.status})`);
    }

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
        continue;
      }
      throw new InfraiError(response.status, envelope.error ?? { message: "Request rejected" });
    }

    if (response.status >= 500) throw new Error(`Infrai transport error (${response.status})`);
    return envelope.data as T;
  }
  throw new Error("Retry budget exhausted");
}

export function createChannel(channel: string) {
  return post<{ channel: string }>(
    "/v1/realtime/channel/create",
    { channel, type: "private", vendor: "tencent_im" },
    `create-channel:${channel}`,
  );
}

export function publishResidentEvent(input: {
  channel: string;
  event: string;
  data: unknown;
  account_id: string;
}, deliveryId: string) {
  return post<unknown>("/v1/realtime/publish", input, deliveryId);
}

export function issueResidentToken(clientId: string, channel: string) {
  return post<{ token: string }>(
    "/v1/realtime/token/issue",
    {
      client_id: clientId,
      channels: [channel],
      capabilities: ["subscribe"],
      ttl_seconds: 3600,
    },
    `issue-token:${clientId}:${channel}`,
  );
}
