export class ApiRequestError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(
    message: string,
    status: number,
    url: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.url = url;
  }
}

const RETRYABLE_STATUS = new Set([502, 503, 504]);

function retryDelay(response?: Response): number {
  const header = Number(response?.headers.get("Retry-After"));
  return Number.isFinite(header) && header > 0 ? Math.min(header * 1_000, 4_000) : 800;
}

/**
 * Fetch JSON and reject HTTP failures instead of treating an error body as
 * successful page data. Read-only requests retry one transient Render wake
 * response; mutations are never repeated automatically.
 */
export async function apiFetchJson<T>(input: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const maxAttempts = method === "GET" ? 2 : 1;
  let lastNetworkError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let response: Response;
    try {
      response = await fetch(input, init);
    } catch (error) {
      lastNetworkError = error;
      if (attempt + 1 < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 800));
        continue;
      }
      throw error;
    }

    if (response.ok) return response.json() as Promise<T>;

    if (response.status === 403 && input.includes("/api/admin")) {
      window.dispatchEvent(new Event("tkdl-admin-unauthorized"));
    }

    if (attempt + 1 < maxAttempts && RETRYABLE_STATUS.has(response.status)) {
      await new Promise(resolve => setTimeout(resolve, retryDelay(response)));
      continue;
    }

    const body = await response.json().catch(() => null) as { error?: string; message?: string } | null;
    throw new ApiRequestError(body?.error ?? body?.message ?? `Request failed (${response.status})`, response.status, input);
  }

  throw lastNetworkError instanceof Error ? lastNetworkError : new Error(`Could not reach ${input}`);
}

export async function apiFetchJsonOr<T>(input: string, fallback: T, init: RequestInit = {}): Promise<T> {
  try {
    return await apiFetchJson<T>(input, init);
  } catch {
    return fallback;
  }
}
