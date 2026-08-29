import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import type { AssistantTurn } from "../../api/types";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";

interface Message {
  role: "patient" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "What exercises do I have today?",
  "How many repetitions should I do?",
  "How do I do this exercise?",
  "How am I doing so far?",
];

/**
 * The patient's assistant.
 *
 * It answers from the prescription the physiotherapist wrote and nothing else.
 * It has no way to change the plan - the guardrails and the missing write path
 * both live on the server.
 */
export function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .assistantHistory()
      .then((history: AssistantTurn[]) => {
        setMessages(
          history.flatMap((turn) => [
            { role: "patient" as const, text: turn.user_message },
            { role: "assistant" as const, text: turn.assistant_response },
          ]),
        );
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setError(null);
    setInput("");
    setMessages((current) => [...current, { role: "patient", text: trimmed }]);
    setSending(true);
    try {
      const reply = await api.askAssistant(trimmed);
      setMessages((current) => [...current, { role: "assistant", text: reply.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not answer just now.");
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-semibold text-text">Ask a question</h1>
        <p className="mt-1 text-muted">
          I can explain the exercises your physiotherapist gave you.
        </p>
      </header>

      {/* The suggestions are the buttons themselves - wrapping them in a panel
          would put a bordered box inside a bordered box for no gain. */}
      {messages.length === 0 && (
        <div>
          <p className="text-muted">Try one of these:</p>
          <div className="mt-3 flex flex-col gap-2.5">
            {SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion}
                variant="secondary"
                size="lg"
                className="justify-between text-left"
                onClick={() => void send(suggestion)}
              >
                {suggestion}
                <Icon name="chevron-right" size="1rem" className="text-subtle" />
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {messages.map((message, index) => (
          <div
            key={`${index}-${message.text.slice(0, 12)}`}
            className={`max-w-[90%] rounded-2xl px-4 py-3 text-lg ${
              message.role === "patient"
                ? "ml-auto bg-accent text-accent-text"
                : "border border-line bg-surface text-text"
            }`}
          >
            {message.text}
          </div>
        ))}
        {sending && <p className="text-muted">Thinking…</p>}
        <div ref={endRef} />
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <form onSubmit={handleSubmit} className="sticky bottom-24 flex gap-2 bg-app py-2">
        <label htmlFor="assistant-input" className="sr-only">
          Your question
        </label>
        <input
          id="assistant-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type your question"
          className="flex-1 rounded-card border border-line-strong bg-surface px-4 py-3 text-lg text-text placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        <Button type="submit" size="lg" loading={sending}>
          Ask
        </Button>
      </form>

      <p className="pb-4 text-sm text-muted">
        This assistant cannot change your exercises or give medical advice. For anything else,
        please contact your physiotherapist.
      </p>
    </div>
  );
}
