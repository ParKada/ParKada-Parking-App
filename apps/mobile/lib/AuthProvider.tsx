import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Alert } from "react-native";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type ProfileStatus = "loading" | "no-profile" | "incomplete" | "complete";

export type AuthMessage = {
  title: string;
  subtitle: string;
};

type AuthContextValue = {
  session: Session | null;
  isSessionReady: boolean;
  profileStatus: ProfileStatus;
  isAdmin: boolean;
  authMessage: AuthMessage;
  refreshProfileStatus: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("loading");
  const [isAdmin, setIsAdmin] = useState(false);
  const [authMessage, setAuthMessage] = useState<AuthMessage>({
    title: "Signing In Back to ParKada",
    subtitle: "Verifying your account...",
  });

  /**
   * Determines where a user should be routed after authentication.
   *
   * Routing logic:
   *   - Admin accounts     → signed out immediately (access denied)
   *   - Email/Password     → always "complete" (registered via the full flow)
   *   - First-time Google  → "no-profile" (no row in profiles table yet)
   *   - Abandoned Google   → "incomplete" (row exists but profile_completed is false)
   *   - Returning Google   → "complete" (profile_completed = true & phone_number present)
   */
  const checkProfile = async (user: User, isColdStart = false): Promise<void> => {
    setProfileStatus("loading");

    try {
      // 1. Admin gate — admins are not allowed in the Driver App at all.
      const { data: adminData } = await supabase
        .from("admin_profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (adminData) {
        Alert.alert(
          "Access Denied",
          "Admin accounts cannot use the Driver App. Please log in via the Admin Portal."
        );
        setIsAdmin(true);
        await supabase.auth.signOut();
        return;
      }

      setIsAdmin(false);

      // 2. Detect provider
      const isGoogleUser =
        user.app_metadata?.provider === "google" ||
        (user.app_metadata?.providers as string[] | undefined)?.includes("google") ||
        user.identities?.some((identity) => identity.provider === "google");

      if (!isGoogleUser) {
        setAuthMessage({
          title: "Signing In to ParKada",
          subtitle: "Loading your dashboard...",
        });
        if (!isColdStart) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
        setProfileStatus("complete");
        return;
      }

      // 3. Google sign-in detected
      setAuthMessage({
        title: "Signing In Back to ParKada",
        subtitle: "Verifying your Google credentials...",
      });

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("phone_number, profile_completed")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Profile query error:", error.message);
        setProfileStatus("incomplete");
        return;
      }

      if (!profile) {
        // Truly first-time Google sign-in
        setAuthMessage({
          title: "Setting Up Account",
          subtitle: "Taking you to complete your profile...",
        });
        if (!isColdStart) {
          await new Promise((resolve) => setTimeout(resolve, 450));
        }
        setProfileStatus("no-profile");
        return;
      }

      // A row exists. Check if the profile is complete.
      const isComplete = Boolean(profile.profile_completed && profile.phone_number);
      if (isComplete) {
        // RETURNING GOOGLE USER: "Signing In Back to ParKada"
        setAuthMessage({
          title: "Signing In Back to ParKada",
          subtitle: "Welcome back! Taking you to the driver home...",
        });
        if (!isColdStart) {
          // Reassuring display time so the user smoothly sees the "Signing In Back to ParKada" page
          await new Promise((resolve) => setTimeout(resolve, 750));
        }
        setProfileStatus("complete");
      } else {
        setAuthMessage({
          title: "Completing Profile",
          subtitle: "Taking you to complete your details...",
        });
        if (!isColdStart) {
          await new Promise((resolve) => setTimeout(resolve, 450));
        }
        setProfileStatus("incomplete");
      }
    } catch (err) {
      console.error("Unexpected error in checkProfile:", err);
      setProfileStatus("incomplete");
    }
  };

  useEffect(() => {
    let mounted = true;

    // COLD START — checkProfile before isSessionReady = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);

      if (data.session?.user) {
        await checkProfile(data.session.user, true);
      } else {
        setProfileStatus("complete");
        setIsAdmin(false);
      }

      if (mounted) {
        setIsSessionReady(true);
      }
    });

    // AUTH STATE CHANGES — fired on OAuth login, sign-in, token refresh
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setIsSessionReady(true);

      if (newSession?.user) {
        await checkProfile(newSession.user, false);
      } else {
        setProfileStatus("complete");
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
        authMessage,
        refreshProfileStatus: async () => {
          if (session?.user) await checkProfile(session.user, false);
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