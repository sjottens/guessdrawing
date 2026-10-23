"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { normalizeRoomCode } from "@guessdrawing/shared";
import { LangSwitch } from "@/components/LangSwitch";
import { Logo } from "@/components/Logo";
import { NameForm } from "@/components/NameForm";
import { GameView } from "@/components/GameView";
import { NebulaScene } from "@/components/NebulaScene";
import { getGameClient, useGameClient, type Result } from "@/lib/game-client";
import { useT } from "@/lib/i18n";
import { getTabName, storeName } from "@/lib/session";

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = normalizeRoomCode(params.code);
  const router = useRouter();
  const snapshot = useGameClient();
  const { t } = useT();
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<Extract<Result, { ok: false }> | null>(null);
  const joining = useRef(false);

  useEffect(() => setName(getTabName()), []);

  const inRoom = snapshot.room?.code === code;

  useEffect(() => {
    if (!name || inRoom || joining.current || error) return;
    joining.current = true;
    void getGameClient()
      .join(code, name)
      .then((res) => {
        if (!res.ok) setError(res);
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
        <div className="panel w-full max-w-sm animate-rise space-y-5 p-6 text-center">
          <p className="eyebrow">{t("room.failed")}</p>
          <p className="text-xl font-medium tracking-tight text-hot">{t(`error.${error.error}`, error.params)}</p>
          <Link href="/" className="btn-primary w-full">
            {t("room.backHome")}
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
        <p className="eyebrow animate-pulse">{t("room.connecting", { code })}</p>
      </Centered>
    );
  }

  return <GameView snapshot={snapshot} room={snapshot.room} onLeave={leave} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  return (
    <>
      <NebulaScene focus="top" />
      <main className="relative z-10 flex min-h-dvh flex-col items-center px-4 pb-10">
        <header className="flex w-full max-w-7xl animate-rise items-center justify-between py-5 sm:px-4 sm:py-7">
          <Link href="/" aria-label={t("room.homeLink")}>
            <Logo small />
          </Link>
          <LangSwitch />
        </header>
        <div className="flex w-full flex-1 flex-col items-center justify-start pt-[min(34vh,340px)]">{children}</div>
      </main>
    </>
  );
}
