import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Eye, EyeOff, ArrowLeft } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as AuthSession from "expo-auth-session";
import Constants, { ExecutionEnvironment } from "expo-constants";

WebBrowser.maybeCompleteAuthSession();

const BG_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663457633559/7LbcgdNcQ8vnZSarPg7jeB/ParKada-mobile-bg-8Wgq9qnQX7R8Lyxjz9xWvm.webp";
const GOOGLE_LOGO_PNG = "https://developers.google.com/identity/images/g-logo.png";

export default function LoginPage() {
  const router = useRouter();

  const [view, setView] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Prevents the same OAuth redirect from being processed twice
  // (once via the Linking "url" event listener, once via the direct
  // openAuthSessionAsync() result) which would otherwise try to
  // exchange the same one-time PKCE code twice and throw an error.
  const isProcessingAuth = useRef(false);
  const processedUrls = useRef(new Set<string>());

  useEffect(() => {
    WebBrowser.warmUpAsync();
    return () => {
      WebBrowser.coolDownAsync();
    };
  }, []);

  const handleBackNavigation = () => {
    if (view === "forgot") {
      setView("login");
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(auth)");
    }
  };

  // Improved to safely extract both Query params (?) and Hash params (#)
  const parseUrlParams = (url: string) => {
    const params: Record<string, string> = {};

    try {
      const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
      const hashPart = url.includes('#') ? url.split('#')[1] : '';

      const extract = (str: string) => {
        if (!str) return;
        str.split('&').forEach(pair => {
          // Use indexOf instead of split('=') so values that themselves
          // contain '=' (common in base64/URL-encoded tokens) aren't truncated.
          const idx = pair.indexOf('=');
          if (idx === -1) return;
          const key = pair.slice(0, idx);
          const val = pair.slice(idx + 1);
          if (key && val) params[key] = decodeURIComponent(val.replace(/\+/g, ' '));
        });
      };

      extract(queryPart);
      extract(hashPart);
    } catch (e) {
      console.log("Error parsing URL", e);
    }

    return {
      accessToken: params.access_token || null,
      refreshToken: params.refresh_token || null,
      code: params.code || null,
      errorDesc: params.error_description || null
    };
  };

  const handleAuthUrl = async (url: string | null) => {
    if (!url) return;
    if (isProcessingAuth.current || processedUrls.current.has(url)) return;

    const { accessToken, refreshToken, code, errorDesc } = parseUrlParams(url);
    if (!accessToken && !code && !errorDesc) return;

    isProcessingAuth.current = true;
    processedUrls.current.add(url);
    setGoogleLoading(true);

    if (Platform.OS === "android") {
      WebBrowser.dismissBrowser();
    }

    try {
      if (errorDesc) {
        Alert.alert("Authentication Alert", errorDesc);
        setGoogleLoading(false);
        isProcessingAuth.current = false;
        return;
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) throw error;
        // Succeeded: Keep googleLoading true until root layout routes away
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        // Succeeded: Keep googleLoading true until root layout routes away
      }
    } catch (e: any) {
      console.log("URL Handling Exception:", e);
      Alert.alert("Authentication Error", e.message || "Failed to authenticate session.");
      setGoogleLoading(false);
      isProcessingAuth.current = false;
    }
  };

  useEffect(() => {
    // Do NOT call getInitialURL() here — it can return stale OAuth URLs from
    // a previous session, causing a double-processing race condition.
    // Fresh redirects arrive via the event listener and the openAuthSessionAsync result.
    const sub = Linking.addEventListener("url", (event) => {
      handleAuthUrl(event.url);
    });

    return () => sub.remove();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Required Fields", "Please enter both email and password.");
      return;
    }

    setLoginLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        const userFriendlyMsg = authError.message.includes("Invalid login credentials")
          ? "Incorrect email or password. Please check your credentials and try again."
          : authError.message;
        Alert.alert("Login Failed", userFriendlyMsg);
      }
      // On success, the root layout's auth listener handles navigation.
    } catch (error: any) {
      Alert.alert("Login Alert", "An unexpected error occurred. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      // Inside Expo Go, forcing a custom "parkada" scheme produces a
      // parkada:// URI that Expo Go isn't registered to catch, so the
      // redirect back into the app silently fails. Only force the
      // custom scheme in a dev/production build; let Expo Go fall back
      // to its own exp:// proxy URL.
      // NOTE: Constants.appOwnership is unreliable on newer Expo SDKs
      // (can be null/undefined even inside Expo Go), so we check
      // executionEnvironment instead, which is the currently
      // recommended way to detect Expo Go.
      const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
      const redirectUrl = AuthSession.makeRedirectUri(
        isExpoGo ? {} : { scheme: "parkada" }
      );

      console.log("Registered Redirect URI:", redirectUrl);

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
        console.log("Full Google Auth URL:", data.url);
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        // Process the redirect purely from the WebBrowser response for a smoother transition
        if (res.type === "success" && res.url) {
          await handleAuthUrl(res.url);
        } else {
          // If the user cancelled the auth session, immediately stop the loading indicator
          setGoogleLoading(false);
          isProcessingAuth.current = false;
        }
      } else {
        setGoogleLoading(false);
        isProcessingAuth.current = false;
      }
    } catch (error: any) {
      Alert.alert("Google Login Alert", error?.message || "An error occurred during Google sign-in.");
      setGoogleLoading(false);
      isProcessingAuth.current = false;
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert("Required Field", "Please enter your email address first.");
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: "parkada://update-password",
      });

      if (error) throw error;

      Alert.alert("Success", "Password reset link sent! Please check your inbox.");
      setView("login");

    } catch (error: any) {
      Alert.alert("Reset Password Alert", error?.message || "Failed to send reset link. Try again.");
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
        <View className="relative h-64 overflow-hidden shrink-0 bg-[#0A1D37]">
          <Image
            source={{ uri: BG_IMG }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
          <View className="absolute inset-0 bg-[#0A1D37]/50" />

          <TouchableOpacity
            onPress={handleBackNavigation}
            className="absolute top-12 left-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center z-10"
          >
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>

          <View className="absolute bottom-8 left-6 right-6 z-10">
            <Text className="text-white/80 text-sm font-medium mb-1">
              {view === "login" ? "Welcome to ParKada: Your Parking Buddy" : "Account Recovery"}
            </Text>
            <Text className="text-3xl font-extrabold text-white">
              {view === "login" ? "Log In" : "Reset Password"}
            </Text>
          </View>
        </View>

        <View className="flex-1 bg-white rounded-t-[30px] -mt-6 px-6 pt-8 pb-8 z-20">
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
                  editable={!loginLoading}
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
                    editable={!loginLoading}
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
                  disabled={loginLoading}
                  className="w-full h-14 bg-[#0A1D37] rounded-xl flex-row justify-center items-center"
                >
                  {loginLoading ? (
                    <ActivityIndicator color="white" className="mr-2" />
                  ) : null}
                  <Text className="text-white text-base font-bold">
                    {loginLoading ? "Logging in..." : "Log In"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row items-center mt-2">
                <View className="flex-1 h-[1px] bg-slate-200" />
                <Text className="text-slate-400 mx-4 font-medium text-xs uppercase tracking-widest">OR</Text>
                <View className="flex-1 h-[1px] bg-slate-200" />
              </View>

              <TouchableOpacity
                onPress={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full h-14 border border-slate-300 rounded-xl flex-row justify-center items-center bg-white shadow-sm"
              >
                {googleLoading ? (
                  <ActivityIndicator color="#0A1D37" className="mr-3" />
                ) : (
                  <Image source={{ uri: GOOGLE_LOGO_PNG }} className="w-5 h-5 mr-3" />
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