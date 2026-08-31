import { useState, useEffect, useCallback } from "react";
import { supabase } from "@parkada/shared";

type Language = "en" | "tl";

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>("en");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the user ID and initialize language
    let isMounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && isMounted) {
        setUserId(user.id);
        const stored = localStorage.getItem(`admin_lang_${user.id}`);
        if (stored === "en" || stored === "tl") {
          setLanguageState(stored);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleLanguageChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ lang: Language; userId: string }>;
      if (userId && customEvent.detail.userId === userId) {
        setLanguageState(customEvent.detail.lang);
      }
    };
    window.addEventListener("languageChanged", handleLanguageChange);
    return () => window.removeEventListener("languageChanged", handleLanguageChange);
  }, [userId]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (userId) {
      localStorage.setItem(`admin_lang_${userId}`, lang);
      window.dispatchEvent(new CustomEvent("languageChanged", { detail: { lang, userId } }));
    }
  }, [userId]);

  const t = useCallback((en: string, tl: string) => {
    return language === "tl" ? tl : en;
  }, [language]);

  return { language, setLanguage, t };
}
