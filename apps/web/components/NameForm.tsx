"use client";

import { useState } from "react";
import { MAX_NAME_LENGTH, sanitizeName } from "@guessdrawing/shared";

export function NameForm({ code, onSubmit }: { code: string; onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");
  const clean = sanitizeName(name);
  return (
    <form
      className="card w-full max-w-sm space-y-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (clean) onSubmit(clean);
      }}
    >
      <h1 className="text-xl font-black text-indigo-900">
        Join kamer <span className="font-mono tracking-widest">{code}</span>
      </h1>
      <input
        className="input"
        autoFocus
        value={name}
        maxLength={MAX_NAME_LENGTH}
        placeholder="Jouw naam"
        autoComplete="nickname"
        onChange={(e) => setName(e.target.value)}
      />
      <button className="btn-primary w-full" disabled={!clean}>
        Meedoen
      </button>
    </form>
  );
}
