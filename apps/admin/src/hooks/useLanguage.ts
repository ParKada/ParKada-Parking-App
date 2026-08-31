import { useState, useEffect, useCallback } from "react";
import { supabase } from "@parkada/shared";

type Language = "en" | "tl";

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    // Initialize language globally
    const stored = localStorage.getItem(`admin_lang`);
    if (stored === "en" || stored === "tl") {
      setLanguageState(stored);
    }
  }, []);

  useEffect(() => {
    const handleLanguageChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ lang: Language }>;
      setLanguageState(customEvent.detail.lang);
    };
    window.addEventListener("languageChanged", handleLanguageChange);
    return () => window.removeEventListener("languageChanged", handleLanguageChange);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(`admin_lang`, lang);
    window.dispatchEvent(new CustomEvent("languageChanged", { detail: { lang } }));
  }, []);

  const t = useCallback((en: string, tl: string) => {
    return language === "tl" ? tl : en;
  }, [language]);

  return { language, setLanguage, t };
}
