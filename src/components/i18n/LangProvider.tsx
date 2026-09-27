"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, type Lang } from "@/lib/i18n/config";
import { localize, type Messages, type Namespace } from "@/lib/i18n/localize";

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
  messages: Messages;
}

const LangContext = createContext<LangState>({ lang: "fr", setLang: () => {}, messages: {} });

export function LangProvider({ lang, messages, children }: { lang: Lang; messages: Messages; children: React.ReactNode }) {
  const router = useRouter();
  const setLang = useCallback(
    (l: Lang) => {
      document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = l;
      router.refresh();
    },
    [router]
  );
  const value = useMemo(() => ({ lang, setLang, messages }), [lang, setLang, messages]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** Copy of a namespace in the current language (translations merged over English). */
export function useCopy<N extends Namespace>(ns: N) {
  const { lang, messages } = useContext(LangContext);
  return useMemo(() => localize(ns, lang, messages), [ns, lang, messages]);
}
