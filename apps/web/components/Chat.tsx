"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_CHAT_LENGTH, type ChatMessage } from "@guessdrawing/shared";
import { chatText, useT } from "@/lib/i18n";
import { playerColor } from "./Avatar";
import { SendIcon } from "./Icons";

const kindStyles: Record<string, string> = {
  chat: "text-fg/85",
  system: "py-1 text-center font-mono text-[11px] tracking-wide text-fg/40",
  correct: "rounded-xl border border-mint/25 bg-mint/10 px-3 py-1.5 font-medium text-mint",
  close: "rounded-xl border border-gold/25 bg-gold/10 px-3 py-1.5 text-gold",
  secret: "rounded-xl bg-mint/[0.06] px-3 py-1.5 text-mint/90",
};

export function Chat({
  messages,
  onSend,
  placeholder,
  disabled = false,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { t } = useT();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message) return;
    onSend(message);
    setText("");
  }

  return (
    <div className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <span className="eyebrow">{t("chat.title")}</span>
        <span className="h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_10px_var(--color-mint)]" />
      </div>
      <div ref={listRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-3 text-sm leading-snug">
        {messages.map((m) => (
          <p key={m.id} className={`animate-pop break-words ${kindStyles[m.kind] ?? ""}`}>
            {m.name && m.kind === "chat" && (
              <span className="font-medium" style={{ color: m.playerId ? playerColor(m.playerId).bg : undefined }}>
                {m.name}{" "}
              </span>
            )}
            {m.name && m.kind !== "chat" && <span className="font-medium">{m.name}: </span>}
            {chatText(m, t)}
          </p>
        ))}
      </div>
      <form onSubmit={submit} className="relative border-t border-white/10 p-3">
        <input
          className="input rounded-full py-2.5 pr-12 pl-4 text-sm"
          value={text}
          maxLength={MAX_CHAT_LENGTH}
          placeholder={placeholder ?? t("chat.guessHere")}
          disabled={disabled}
          enterKeyHint="send"
          autoComplete="off"
          autoCorrect="off"
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          aria-label={t("chat.send")}
          disabled={disabled || !text.trim()}
          className="absolute top-1/2 right-5 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-accent text-white transition enabled:hover:brightness-110 disabled:opacity-0"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
