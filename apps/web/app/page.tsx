"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_NAME_LENGTH, ROOM_CODE_LENGTH, normalizeRoomCode, sanitizeName } from "@guessdrawing/shared";
import { Logo } from "@/components/Logo";
import { getGameClient } from "@/lib/game-client";
import { getStoredName, storeName } from "@/lib/session";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setName(getStoredName()), []);

  const cleanName = sanitizeName(name);

  async function create() {
    if (!cleanName) return setError("Kies eerst een naam");
    setBusy(true);
    setError(null);
    storeName(cleanName);
    const res = await getGameClient().join(undefined, cleanName);
    if (res.ok) router.push(`/room/${res.data.code}`);
    else {
      setError(res.message);
      setBusy(false);
    }
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    if (!cleanName) return setError("Kies eerst een naam");
    const c = normalizeRoomCode(code);
    if (c.length !== ROOM_CODE_LENGTH) return setError("Vul een geldige kamercode in");
    storeName(cleanName);
    router.push(`/room/${c}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-4 py-10">
      <div className="text-center">
        <Logo />
        <p className="mt-2 font-semibold text-indigo-100">Teken. Raad. Win.</p>
      </div>

      <div className="card w-full space-y-5 p-6">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-indigo-900">Jouw naam</span>
          <input
            className="input"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            placeholder="bijv. Picasso"
            autoComplete="nickname"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <button className="btn-primary w-full text-lg" onClick={create} disabled={busy}>
          {busy ? "Bezig…" : "Nieuwe kamer maken"}
        </button>

        <div className="flex items-center gap-3 text-xs font-bold uppercase text-slate-400">
          <span className="h-px flex-1 bg-slate-200" /> of join een kamer <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={join} className="flex gap-2">
          <input
            className="input text-center font-mono text-lg uppercase tracking-[0.3em]"
            value={code}
            placeholder="CODE"
            maxLength={ROOM_CODE_LENGTH}
            autoCapitalize="characters"
            onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
          />
          <button className="btn-secondary shrink-0" type="submit">
            Join
          </button>
        </form>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{error}</p>}
      </div>
    </main>
  );
}
