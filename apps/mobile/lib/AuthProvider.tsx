import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Alert } from "react-native";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type ProfileStatus = "loading" | "no-profile" | "incomplete" | "complete";

type AuthContextValue = {
  session: Session | null;
  isSessionReady: boolean; // true once the initial getSession() check has resolved
  profileStatus: ProfileStatus;
  isAdmin: boolean;
  refreshProfileStatus: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("loading");
  const [isAdmin, setIsAdmin] = useState(false);

  const checkProfile = async (user: { id: string; app_metadata?: { provider?: string } }) => {
    setProfileStatus("loading");

    const { data: adminData } = await supabase
      .from("admin_profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (adminData) {
      // Admins are not allowed in the Driver App at all. Sign them out;
      // the resulting auth-state change will reset everything back to
      // "logged out" and the root layout will route to /login.
      Alert.alert(
        "Access Denied",
        "Admin accounts cannot use the Driver App. Please log in via the Admin Portal."
      );
      await supabase.auth.signOut();
      return;
    }

    setIsAdmin(false);

    // The Complete Profile gate only applies to Google sign-ins — an
    // account created via email/password already went through the
    // regular registration flow and collected everything needed, so
    // it should always proceed straight through regardless of what's
    // currently in the profiles row.
    const isGoogleSignIn = user.app_metadata?.provider === "google";

    if (!isGoogleSignIn) {
      setProfileStatus("complete");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("phone_number, profile_completed")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      setProfileStatus("no-profile");
      return;
    }

    setProfileStatus(profile.profile_completed && profile.phone_number ? "complete" : "incomplete");
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setIsSessionReady(true);
      if (data.session?.user) {
        checkProfile(data.session.user);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setIsSessionReady(true);
      if (newSession?.user) {
        checkProfile(newSession.user);
      } else {
        setProfileStatus("loading");
        setIsAdmin(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        isSessionReady,
        profileStatus,
        isAdmin,
        refreshProfileStatus: async () => {
          if (session?.user) await checkProfile(session.user);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}