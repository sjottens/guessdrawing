"use client";

import { useEffect } from "react";
import { LANGS } from "@guessdrawing/shared";
import { setLang, useT } from "@/lib/i18n";

/** NL | EN pill. */
export function LangSwitch() {
  const { lang, t } = useT();
  return (
    <div
      role="group"
      aria-label={t("lang.switch")}
      className="flex items-center rounded-full border border-white/10 bg-white/[0.04] p-0.5 font-mono text-[11px] tracking-[0.12em]"
    >
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          title={t(`lang.${l}`)}
          onClick={() => setLang(l)}
          className={`cursor-pointer rounded-full px-2.5 py-1 uppercase transition ${
            lang === l ? "bg-white/15 text-fg" : "text-fg/45 hover:text-fg"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** Keeps <html lang> and the tab title in the chosen language. */
export function LangSync() {
  const { lang, t } = useT();
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t("meta.title");
  }, [lang, t]);
  return null;
}
