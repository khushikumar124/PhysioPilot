import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import type { AssistantTurn } from "../../api/types";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";

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
        <h1 className="text-3xl font-semibold text-ink-900">Ask a question</h1>
        <p className="mt-1 text-ink-600">
          I can explain the exercises your physiotherapist gave you.
        </p>
      </header>

      {messages.length === 0 && (
        <div className="rounded-2xl border border-ink-200 bg-white p-5">
          <p className="text-ink-700">Try one of these:</p>
          <div className="mt-3 flex flex-col gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion}
                variant="secondary"
                size="lg"
                className="justify-start text-left"
                onClick={() => void send(suggestion)}
              >
                {suggestion}
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
                ? "ml-auto bg-brand-700 text-white"
                : "border border-ink-200 bg-white text-ink-800"
            }`}
          >
            {message.text}
          </div>
        ))}
        {sending && <p className="text-ink-500">Thinking…</p>}
        <div ref={endRef} />
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <form onSubmit={handleSubmit} className="sticky bottom-24 flex gap-2 bg-ink-50 py-2">
        <label htmlFor="assistant-input" className="sr-only">
          Your question
        </label>
        <input
          id="assistant-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type your question"
          className="flex-1 rounded-xl border border-ink-300 bg-white px-4 py-3 text-lg focus:border-brand-600 focus:outline-none"
        />
        <Button type="submit" size="lg" loading={sending}>
          Ask
        </Button>
      </form>

      <p className="pb-4 text-sm text-ink-500">
        This assistant cannot change your exercises or give medical advice. For anything else,
        please contact your physiotherapist.
      </p>
    </div>
  );
}
