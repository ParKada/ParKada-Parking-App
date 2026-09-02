import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Eye, EyeOff, ArrowLeft } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

// Kinakailangan para sa in-app browser auth sessions
WebBrowser.maybeCompleteAuthSession();

const BG_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663457633559/7LbcgdNcQ8vnZSarPg7jeB/ParKada-mobile-bg-8Wgq9qnQX7R8Lyxjz9xWvm.webp";

export default function LoginPage() {
  const router = useRouter();
  
  const [view, setView] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleBackNavigation = () => {
    if (view === "forgot") {
      setView("login");
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(auth)");
    }
  };

  // Helper para kumuha ng url params mula sa Hash (#) o Search (?)
  const extractTokensFromUrl = (url: string) => {
    let accessToken: string | null = null;
    let refreshToken: string | null = null;

    if (url.includes("#")) {
      const hashString = url.split("#")[1];
      const params = new URLSearchParams(hashString);
      accessToken = params.get("access_token");
      refreshToken = params.get("refresh_token");
    }

    if (!accessToken && url.includes("?")) {
      const queryString = url.split("?")[1];
      const params = new URLSearchParams(queryString);
      accessToken = params.get("access_token");
      refreshToken = params.get("refresh_token");
    }

    return { accessToken, refreshToken };
  };

  // Deep Link Listener para sa Google OAuth Callback
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      if (url.includes("access_token") || url.includes("refresh_token") || url.includes("code=")) {
        try {
          const { accessToken, refreshToken } = extractTokensFromUrl(url);

          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
            if (data?.user) {
              await verifyAndEnsureRegularUser(data.user);
              return;
            }
          }

          const { data, error } = await (supabase.auth as any).getSessionFromUrl(url);
          if (error) throw error;
          if (data?.session?.user) {
            await verifyAndEnsureRegularUser(data.session.user);
          }
        } catch (e: any) {
          Alert.alert("Authentication Error", e.message || "Failed to process login token.");
        }
      }
    };

    Linking.getInitialURL().then(handleUrl);

    const sub = Linking.addEventListener("url", (event) => {
      handleUrl(event.url);
    });

    return () => sub.remove();
  }, []);

  const verifyAndEnsureRegularUser = async (user: any) => {
    if (!user) return;

    try {
      // 1. Harangin kung Admin account
      const { data: adminData } = await supabase
        .from("admin_profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (adminData) {
        await supabase.auth.signOut();
        Alert.alert(
          "Access Denied",
          "Admin accounts cannot use the Driver App. Please log in via the Admin Portal."
        );
        return;
      }

      // 2. Suriin kung umiiral na ang profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile) {
        // Parse Name mula sa Google metadata
        const rawName = user.user_metadata?.full_name || user.user_metadata?.name || "Driver User";
        const nameParts = rawName.split(" ");
        const firstName = nameParts[0] || "Driver";
        const lastName = nameParts.slice(1).join(" ") || "User";

        // BAGONG USER: I-upsert sa profiles table gamit ang tamang columns
        const { error: insertError } = await supabase.from("profiles").upsert({
          id: user.id,
          email: user.email,
          first_name: firstName,
          last_name: lastName,
          user_type: "driver",
          discount_type: "regular",
          verification_status: "unverified",
          updated_at: new Date().toISOString(),
        });

        if (insertError) {
          console.error("PROFILES INSERT ERROR:", insertError);
          throw insertError;
        }
      }

      // 3. DIREKTANG REDIRECT SA HOME PAGE
      router.replace("/(tabs)");

    } catch (error: any) {
      console.error("VERIFY USER ERROR:", error);
      Alert.alert("Login Error", error.message || "Failed to complete sign-in.");
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        await verifyAndEnsureRegularUser(authData.user);
      }
    } catch (error: any) {
      console.error("LOGIN ERROR:", error);
      Alert.alert("Login Failed", error.message || "Invalid login credentials.");
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const redirectUrl = Linking.createURL('/', { scheme: 'parkada' });
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (error) throw error;

      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        if (res.type === 'success' && res.url) {
          const { accessToken, refreshToken } = extractTokensFromUrl(res.url);

          if (accessToken && refreshToken) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) throw sessionError;

            if (sessionData.user) {
              await verifyAndEnsureRegularUser(sessionData.user);
              return;
            }
          }

          const { data: sessionData, error: sessionError } = await (supabase.auth as any).getSessionFromUrl(res.url);
          if (sessionError) throw sessionError;

          if (sessionData.session?.user) {
            await verifyAndEnsureRegularUser(sessionData.session.user);
          }
        }
      }
    } catch (error: any) {
      console.error("GOOGLE LOGIN ERROR:", error);
      Alert.alert("Google Login Failed", error.message || "An error occurred during Google sign-in.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email address first.");
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "parkada://update-password",
      });

      if (error) throw error;

      Alert.alert("Success", "Password reset link sent! Please check your inbox.");
      setView("login"); 
      
    } catch (error: any) {
      console.error("RESET ERROR:", error);
      Alert.alert("Failed", error.message || "Failed to send reset link. Try again.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
        {/* Header Area */}
        <View className="relative h-64 overflow-hidden shrink-0">
          <Image source={{ uri: BG_IMG }} className="w-full h-full" resizeMode="cover" />
          <View className="absolute inset-0 bg-[#0A1D37]/80" />
          
          <TouchableOpacity 
            onPress={handleBackNavigation} 
            className="absolute top-12 left-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>

          <View className="absolute bottom-8 left-6 right-6">
            <Text className="text-white/70 text-sm font-medium mb-1">
              {view === "login" ? "Welcome to ParKada: Your Parking Buddy" : "Account Recovery"}
            </Text>
            <Text className="text-3xl font-extrabold text-white">
              {view === "login" ? "Log In" : "Reset Password"}
            </Text>
          </View>
        </View>

        {/* Form Area */}
        <View className="flex-1 bg-white rounded-t-[30px] -mt-6 px-6 pt-8 pb-8">
          {view === "login" ? (
            <View className="space-y-6 flex-col gap-5">
              <View className="flex-col gap-2">
                <Text className="text-sm font-semibold text-slate-700">Email Address</Text>
                <TextInput 
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email} 
                  onChangeText={setEmail} 
                  placeholder="juan@example.com" 
                  className="h-14 px-4 rounded-xl bg-slate-100 text-slate-800" 
                />
              </View>

              <View className="flex-col gap-2">
                <Text className="text-sm font-semibold text-slate-700">Password</Text>
                <View className="relative justify-center">
                  <TextInput 
                    secureTextEntry={!showPass}
                    value={password} 
                    onChangeText={setPassword} 
                    placeholder="Enter your password" 
                    className="h-14 px-4 pr-12 rounded-xl bg-slate-100 text-slate-800" 
                  />
                  <TouchableOpacity 
                    onPress={() => setShowPass(!showPass)} 
                    className="absolute right-4"
                  >
                    {showPass ? <EyeOff size={20} color="#64748B" /> : <Eye size={20} color="#64748B" />}
                  </TouchableOpacity>
                </View>

                <View className="items-end pt-1">
                  <TouchableOpacity onPress={() => setView("forgot")}>
                    <Text className="text-sm font-semibold text-blue-600">Forgot Password?</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View>
                <TouchableOpacity
                  onPress={handleLogin}
                  className="w-full h-14 bg-[#0A1D37] rounded-xl flex-row justify-center items-center"
                >
                  <Text className="text-white text-base font-bold">
                    Log In
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row items-center mt-2">
                <View className="flex-1 h-[1px] bg-slate-200" />
                <Text className="text-slate-400 mx-4 font-medium text-xs uppercase tracking-widest">OR</Text>
                <View className="flex-1 h-[1px] bg-slate-200" />
              </View>

              {/* Continue with Google button */}
              <TouchableOpacity
                onPress={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full h-14 border border-slate-300 rounded-xl flex-row justify-center items-center bg-white shadow-sm"
              >
                {googleLoading ? (
                  <ActivityIndicator color="#0A1D37" className="mr-3" />
                ) : (
                  <Image source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" }} className="w-5 h-5 mr-3" />
                )}
                <Text className="text-slate-700 text-base font-bold">
                  {googleLoading ? "Signing in..." : "Continue with Google"}
                </Text>
              </TouchableOpacity>

              <View className="flex-row justify-center mt-6">
                <Text className="text-sm text-slate-500">Don't have an account yet? </Text>
                <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
                  <Text className="text-sm text-blue-600 font-semibold">Create Account</Text>
                </TouchableOpacity>
              </View>
            </View>

          ) : (
            <View className="space-y-6 flex-col gap-5">
              <Text className="text-sm text-slate-500 leading-relaxed mb-2">
                Enter the email address associated with your account and we'll send you a link to reset your password.
              </Text>

              <View className="flex-col gap-2">
                <Text className="text-sm font-semibold text-slate-700">Email Address</Text>
                <TextInput 
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email} 
                  onChangeText={setEmail} 
                  placeholder="juan@example.com" 
                  className="h-14 px-4 rounded-xl bg-slate-100 text-slate-800" 
                  editable={!resetLoading}
                />
              </View>

              <TouchableOpacity
                onPress={handleResetPassword}
                disabled={resetLoading}
                className="w-full h-14 bg-[#0A1D37] rounded-xl mt-4 flex-row justify-center items-center"
              >
                {resetLoading ? <ActivityIndicator color="white" className="mr-2" /> : null}
                <Text className="text-white text-base font-bold">
                  {resetLoading ? "Sending link..." : "Send Reset Link"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
} 