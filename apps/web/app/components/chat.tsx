'use client';

import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  type ChatMessage,
  ChatRequestError,
  streamChat,
} from '../lib/stream-chat';
import styles from './chat.module.css';

const MAX_INPUT_LENGTH = 4000;

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep the newest text in view while the reply grows.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  // Cancel an in-flight request when the component unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    const history: ChatMessage[] = [
      ...messages,
      { role: 'user', content: text },
    ];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setError(null);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let received = false;

    try {
      await streamChat({
        messages: history,
        signal: controller.signal,
        onDelta: (delta) => {
          received = true;
          setMessages((current) => {
            const last = current[current.length - 1];
            if (!last || last.role !== 'assistant') return current;
            return [
              ...current.slice(0, -1),
              { ...last, content: last.content + delta },
            ];
          });
        },
      });
    } catch (caught) {
      const stopped = controller.signal.aborted;
      if (!stopped) {
        setError(
          caught instanceof ChatRequestError
            ? caught.message
            : 'Something went wrong.',
        );
      }
      if (!received) {
        // Nothing was answered: take the question back so it can be edited and resent.
        setMessages(messages);
        setInput(text);
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void send();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter inserts a new line. Ignore Enter used to confirm IME input.
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <div className={styles.chat}>
      <h1 className={styles.title}>Design System Copilot</h1>

      {/* aria-busy delays announcements until the reply is complete, instead of reading every chunk. */}
      <div
        ref={logRef}
        className={styles.log}
        role="log"
        aria-live="polite"
        aria-busy={streaming}
        aria-label="Conversation"
        tabIndex={0}
      >
        {messages.length === 0 ? (
          <p className={styles.empty}>
            Ask a question about your design system to get started.
          </p>
        ) : (
          <ol className={styles.messages}>
            {messages.map((message, index) => (
              <li
                key={index}
                className={
                  message.role === 'user' ? styles.user : styles.assistant
                }
              >
                <span className={styles.visuallyHidden}>
                  {message.role === 'user' ? 'You: ' : 'Assistant: '}
                </span>
                {message.content}
              </li>
            ))}
          </ol>
        )}
      </div>

      <p className={styles.status} role="status">
        {streaming ? 'Assistant is typing…' : ''}
      </p>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <form className={styles.form} onSubmit={handleSubmit}>
        <label htmlFor="message" className={styles.label}>
          Your message
        </label>
        <textarea
          id="message"
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_INPUT_LENGTH}
          rows={3}
          aria-describedby="message-hint"
        />
        <p id="message-hint" className={styles.hint}>
          Press Enter to send, Shift+Enter for a new line.
        </p>
        <div className={styles.actions}>
          {streaming ? (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => abortRef.current?.abort()}
            >
              Stop
            </button>
          ) : null}
          <button
            type="submit"
            className={styles.primary}
            disabled={streaming || !input.trim()}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
