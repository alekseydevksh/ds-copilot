export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export class ChatRequestError extends Error {}

type StreamChatOptions = {
  messages: ChatMessage[];
  signal: AbortSignal;
  onDelta: (text: string) => void;
};

const GENERIC_ERROR =
  'Something went wrong while contacting the assistant. Please try again.';

// Sends the conversation and calls onDelta for every text chunk until the stream ends.
// Throws ChatRequestError with a user-facing message on any failure.
export async function streamChat({
  messages,
  signal,
  onDelta,
}: StreamChatOptions): Promise<void> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!response.ok) {
    throw new ChatRequestError(await readErrorMessage(response));
  }
  if (!response.body) {
    throw new ChatRequestError(GENERIC_ERROR);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let finished = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;

    // Events are separated by a blank line.
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      if (handleFrame(frame, onDelta)) finished = true;
      boundary = buffer.indexOf('\n\n');
    }
  }

  if (!finished) {
    throw new ChatRequestError(
      'The response was interrupted. Please try again.',
    );
  }
}

// Returns true when the frame is the final "done" event.
function handleFrame(frame: string, onDelta: (text: string) => void): boolean {
  let event = 'message';
  let data = '';
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }

  if (event === 'delta') {
    const payload = safeParse(data);
    if (typeof payload?.text === 'string') onDelta(payload.text);
    return false;
  }
  if (event === 'error') {
    const payload = safeParse(data);
    throw new ChatRequestError(
      typeof payload?.message === 'string' ? payload.message : GENERIC_ERROR,
    );
  }
  return event === 'done';
}

function safeParse(data: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(data);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  // Validation errors carry readable messages; everything else gets a generic one.
  if (response.status === 400) {
    const payload = safeParse(await response.text());
    const message = payload?.message;
    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string') return message;
  }
  return GENERIC_ERROR;
}
