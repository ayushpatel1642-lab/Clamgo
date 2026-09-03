// Resilient API Client with automatic retry for transient network drops

interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelayMs?: number;
}

export async function apiFetch(url: string, options: FetchOptions = {}): Promise<Response> {
  const { retries = 2, retryDelayMs = 600, ...fetchOptions } = options;

  // Set default Accept header
  const headers = new Headers(fetchOptions.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  fetchOptions.headers = headers;

  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);
      return response;
    } catch (err: any) {
      lastError = err;
      const isNetworkError = err?.name === 'TypeError' || err?.message?.includes('Failed to fetch') || err?.message?.includes('network');
      
      // If it's the last attempt or not a network glitch, don't wait
      if (attempt === retries || !isNetworkError) {
        break;
      }

      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
    }
  }

  throw lastError || new Error('Network request failed');
}

export async function safeJson<T = any>(res: Response, fallback: T): Promise<T> {
  try {
    if (!res.ok) return fallback;
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return fallback;
    }
    return await res.json();
  } catch {
    return fallback;
  }
}
