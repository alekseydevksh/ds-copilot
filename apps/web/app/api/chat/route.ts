// Proxies chat requests to the API so the browser only talks to the Next.js origin (no CORS).
// The API address is read at request time, so it can change without rebuilding.

export const dynamic = 'force-dynamic';

const DEFAULT_API_URL = 'http://localhost:3001';

export async function POST(request: Request): Promise<Response> {
  const apiUrl = process.env.API_URL ?? DEFAULT_API_URL;

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: await request.text(),
      // Cancels the upstream request when the browser aborts.
      signal: request.signal,
    });
  } catch {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return Response.json(
      { message: 'The chat service is unavailable' },
      { status: 502 },
    );
  }

  // Pass the body through untouched so chunks reach the browser as they arrive.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type':
        upstream.headers.get('Content-Type') ?? 'application/json',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
