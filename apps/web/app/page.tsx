"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DRAW_TIME_MS,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  ROOM_CODE_LENGTH,
  normalizeRoomCode,
  sanitizeName,
} from "@guessdrawing/shared";
import { ArrowIcon } from "@/components/Icons";
import { LangSwitch } from "@/components/LangSwitch";
import { Logo } from "@/components/Logo";
import { NebulaScene } from "@/components/NebulaScene";
import type { ShapeEvent } from "@/components/nebula-three";
import { getGameClient } from "@/lib/game-client";
import { useT, type MessageKey, type Params } from "@/lib/i18n";
import { getStoredName, storeName } from "@/lib/session";

const STEPS = [1, 2, 3] as const;
const STEP_PARAMS: Params = { min: MIN_PLAYERS_TO_START, max: MAX_PLAYERS, seconds: DRAW_TIME_MS / 1000 };

export default function HomePage() {
  const router = useRouter();
  const { lang, t } = useT();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ key: MessageKey; params?: Params } | null>(null);
  const [shape, setShape] = useState<ShapeEvent | null>(null);

  // Prefill the last used name, without overwriting anything typed already.
  useEffect(() => setName((n) => n || getStoredName()), []);

  const cleanName = sanitizeName(name);

  async function create() {
    if (!cleanName) return setError({ key: "error.nameFirst" });
    setBusy(true);
    setError(null);
    storeName(cleanName);
    // The room's words follow the language of whoever creates it.
    const res = await getGameClient().createRoom(lang);
    if (res.ok) router.push(`/room/${res.data.code}`);
    else {
      setError({ key: `error.${res.error}`, params: res.params });
      setBusy(false);
    }
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    if (!cleanName) return setError({ key: "error.nameFirst" });
    const c = normalizeRoomCode(code);
    if (c.length !== ROOM_CODE_LENGTH) return setError({ key: "error.invalidCode" });
    storeName(cleanName);
    router.push(`/room/${c}`);
  }

  return (
    <>
      <NebulaScene focus="right" onShape={setShape} />

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 sm:px-8">
        <header className="flex animate-rise items-center justify-between gap-3 py-5 sm:py-7">
          <Logo small />
          <div className="flex items-center gap-4">
            <p className="eyebrow hidden md:block">{t("home.tagline", { min: MIN_PLAYERS_TO_START, max: MAX_PLAYERS })}</p>
            <LangSwitch />
          </div>
        </header>

        <div className="flex flex-1 items-center">
          <section className="w-full pt-[38vh] pb-10 lg:max-w-[46%] lg:pt-4">
            <ShapeCaption shape={shape} />

            <p className="eyebrow animate-rise [animation-delay:100ms]">{t("home.eyebrow")}</p>
            <h1 className="mt-4 animate-rise text-[clamp(3.4rem,9vw,7.25rem)] leading-[0.88] font-medium tracking-[-0.055em] [animation-delay:180ms]">
              {t("home.title1")}
              <br />
              <span className="text-fg/30">{t("home.title2")}</span>
            </h1>
            <p className="mt-6 max-w-md animate-rise text-lg leading-relaxed text-fg/60 [animation-delay:260ms]">
              {t("home.intro")}
            </p>

            <div className="panel mt-9 max-w-md animate-rise space-y-4 p-5 sm:p-6 [animation-delay:340ms]">
              <label className="block">
                <span className="eyebrow mb-2 block">{t("home.name")}</span>
                <input
                  className="input"
                  value={name}
                  maxLength={MAX_NAME_LENGTH}
                  placeholder={t("home.namePlaceholder")}
                  autoComplete="nickname"
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <button className="btn-accent group w-full py-3.5 text-base" onClick={create} disabled={busy}>
                {busy ? t("home.creating") : t("home.create")}
                <ArrowIcon className="h-4 w-4 transition-transform group-enabled:group-hover:translate-x-1" />
              </button>

              <div className="eyebrow flex items-center gap-3">
                <span className="h-px flex-1 bg-white/10" /> {t("home.orJoin")} <span className="h-px flex-1 bg-white/10" />
              </div>

              <form onSubmit={join} className="flex gap-2">
                <input
                  className="input text-center font-mono text-lg tracking-[0.4em] uppercase"
                  value={code}
                  placeholder="CODE"
                  maxLength={ROOM_CODE_LENGTH}
                  autoCapitalize="characters"
                  aria-label={t("home.code")}
                  onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
                />
                <button className="btn-secondary shrink-0 px-6" type="submit">
                  {t("home.join")}
                </button>
              </form>

              {error && (
                <p className="animate-pop rounded-xl border border-hot/30 bg-hot/10 px-3 py-2 text-sm font-medium text-hot">
                  {t(error.key, error.params)}
                </p>
              )}
            </div>
          </section>
        </div>

        <footer className="grid animate-rise gap-6 border-t border-white/10 py-7 [animation-delay:450ms] sm:grid-cols-3 lg:max-w-[60%]">
          {STEPS.map((n) => (
            <div key={n}>
              <p className="font-mono text-xs text-accent">0{n}</p>
              <p className="mt-2 font-medium tracking-tight">{t(`home.step${n}.title`)}</p>
              <p className="mt-1 text-sm leading-relaxed text-fg/50">{t(`home.step${n}.text`, STEP_PARAMS)}</p>
            </div>
          ))}
        </footer>
      </main>
    </>
  );
}

/** Live caption for the doodle the particles are drawing. */
function ShapeCaption({ shape }: { shape: ShapeEvent | null }) {
  const { t } = useT();
  if (!shape) return null;
  return (
    <div className="mb-8 flex justify-center lg:pointer-events-none lg:fixed lg:top-[80vh] lg:left-[74%] lg:mb-0 lg:-translate-x-1/2">
      <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-bg/50 py-2 pr-4 pl-3 backdrop-blur-md">
        <span className={`h-2 w-2 rounded-full ${shape.done ? "bg-mint" : "animate-pulse bg-hot"}`} />
        <span className="font-mono text-[11px] tracking-[0.18em] text-fg/45 uppercase">
          {shape.done ? t("home.guessed") : t("home.live")}
        </span>
        <span key={`${shape.name}-${shape.done}`} className="animate-pop text-sm font-medium">
          {shape.done ? `${t(`shape.${shape.name}`)}!` : t("home.whatIsIt")}
        </span>
      </div>
    </div>
  );
}
