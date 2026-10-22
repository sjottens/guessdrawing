"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { normalizeRoomCode } from "@guessdrawing/shared";
import { Logo } from "@/components/Logo";
import { NameForm } from "@/components/NameForm";
import { GameView } from "@/components/GameView";
import { getGameClient, useGameClient } from "@/lib/game-client";
import { getStoredName, storeName } from "@/lib/session";

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = normalizeRoomCode(params.code);
  const router = useRouter();
  const snapshot = useGameClient();
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const joining = useRef(false);

  useEffect(() => setName(getStoredName()), []);

  const inRoom = snapshot.room?.code === code;

  useEffect(() => {
    if (!name || inRoom || joining.current || error) return;
    joining.current = true;
    void getGameClient()
      .join(code, name)
      .then((res) => {
        if (!res.ok) setError(res.message);
      })
      .finally(() => {
        joining.current = false;
      });
  }, [name, code, inRoom, error]);

  function leave() {
    getGameClient().leave();
    router.push("/");
  }

  if (error) {
    return (
      <Centered>
        <div className="card w-full max-w-sm space-y-4 p-6 text-center">
          <p className="text-lg font-bold text-rose-600">{error}</p>
          <Link href="/" className="btn-primary w-full">
            Terug naar start
          </Link>
        </div>
      </Centered>
    );
  }

  if (name === null) return null;

  if (!name) {
    return (
      <Centered>
        <NameForm
          code={code}
          onSubmit={(n) => {
            storeName(n);
            setName(n);
          }}
        />
      </Centered>
    );
  }

  if (!inRoom || !snapshot.room) {
    return (
      <Centered>
        <p className="animate-pulse font-bold text-white">Verbinden met kamer {code}…</p>
      </Centered>
    );
  }

  return <GameView snapshot={snapshot} room={snapshot.room} onLeave={leave} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
      <Logo />
      {children}
    </main>
  );
}
