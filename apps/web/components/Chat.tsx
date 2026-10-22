"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_CHAT_LENGTH, type ChatMessage } from "@guessdrawing/shared";

const kindStyles: Record<string, string> = {
  chat: "text-slate-800",
  system: "text-indigo-500 italic",
  correct: "font-bold text-emerald-600",
  close: "font-semibold text-amber-600",
  secret: "text-emerald-700 bg-emerald-50 -mx-1 px-1 rounded",
};

export function Chat({
  messages,
  onSend,
  placeholder = "Typ je gok hier…",
  disabled = false,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <div className="card flex h-full min-h-0 flex-col overflow-hidden">
      <div ref={listRef} className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-2 text-sm">
        {messages.map((m) => (
          <p key={m.id} className={`break-words ${kindStyles[m.kind] ?? ""}`}>
            {m.name && <span className="font-bold">{m.name}: </span>}
            {m.text}
          </p>
        ))}
      </div>
      <form onSubmit={submit} className="border-t border-slate-100 p-2">
        <input
          className="input py-2"
          value={text}
          maxLength={MAX_CHAT_LENGTH}
          placeholder={placeholder}
          disabled={disabled}
          enterKeyHint="send"
          autoComplete="off"
          autoCorrect="off"
          onChange={(e) => setText(e.target.value)}
        />
      </form>
    </div>
  );
}
