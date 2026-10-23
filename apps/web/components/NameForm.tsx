"use client";

import { useState } from "react";
import { MAX_NAME_LENGTH, sanitizeName } from "@guessdrawing/shared";
import { useT } from "@/lib/i18n";
import { ArrowIcon } from "./Icons";

export function NameForm({ code, onSubmit }: { code: string; onSubmit: (name: string) => void }) {
  const { t } = useT();
  const [name, setName] = useState("");
  const clean = sanitizeName(name);
  return (
    <form
      className="panel w-full max-w-sm animate-rise space-y-5 p-6 sm:p-7"
      onSubmit={(e) => {
        e.preventDefault();
        if (clean) onSubmit(clean);
      }}
    >
      <div>
        <p className="eyebrow">{t("join.invited")}</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.04em]">
          {t("join.title")} <span className="font-mono tracking-[0.2em] text-accent">{code}</span>
        </h1>
      </div>
      <label className="block">
        <span className="eyebrow mb-2 block">{t("home.name")}</span>
        <input
          className="input"
          autoFocus
          value={name}
          maxLength={MAX_NAME_LENGTH}
          placeholder={t("join.placeholder")}
          autoComplete="nickname"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button className="btn-accent group w-full py-3.5" disabled={!clean}>
        {t("join.submit")}
        <ArrowIcon className="h-4 w-4 transition-transform group-enabled:group-hover:translate-x-1" />
      </button>
    </form>
  );
}
