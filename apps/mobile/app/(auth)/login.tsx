import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Eye, EyeOff, ArrowLeft } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

// Required for Expo Web Browser redirects to complete
WebBrowser.maybeCompleteAuthSession();

const BG_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663457633559/7LbcgdNcQ8vnZSarPg7jeB/ParKada-mobile-bg-8Wgq9qnQX7R8Lyxjz9xWvm.webp";

export default function LoginPage() {
  const router = useRouter();
  
  const [view, setView] = useState<"login" | "forgot">("login");
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // Magic Link / Deep Link Listener
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (url && url.includes("#access_token")) {
        try {
          // @ts-ignore: getSessionFromUrl is missing from Supabase v2 types but works in this build
          const { data, error } = await (supabase.auth as any).getSessionFromUrl(url);
          if (error) throw error;
          if (data?.session) {
            verifyNotAdmin(data.session.user.id);
          }
        } catch (e: any) {
          Alert.alert("Magic Link Error", e.message);
        }
      }
    };

    // Check initial URL
    Linking.getInitialURL().then(handleUrl);

    // Listen for incoming links while app is open
    const sub = Linking.addEventListener("url", (event) => {
      handleUrl(event.url);
    });

    return () => sub.remove();
  }, []);

  const verifyNotAdmin = async (userId: string) => {
    const { data: adminData } = await supabase
      .from("admin_profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (adminData) {
      await supabase.auth.signOut();
      throw new Error("Access Denied: Admin accounts cannot use the Driver App. Please log in via the Admin Portal.");
    }
    Alert.alert("Success", "Login successful! Welcome back.");
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user?.id) {
        await verifyNotAdmin(authData.user.id);
      }
    } catch (error: any) {
      console.error("LOGIN ERROR:", error);
      Alert.alert("Login Failed", error.message || "Invalid login credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email address first.");
      return;
    }
    setLoading(true);
    try {
      const redirectUrl = Linking.createURL('/');
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectUrl }
      });
      if (error) throw error;
      Alert.alert("Check your inbox", "We sent a magic link to log you in instantly!");
    } catch (error: any) {
      console.error("OTP ERROR:", error);
      Alert.alert("Failed", error.message || "Could not send magic link.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const redirectUrl = Linking.createURL('/');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });
      
      if (error) throw error;
      
      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (res.type === 'success' && res.url) {
          // @ts-ignore: getSessionFromUrl is missing from Supabase v2 types but works in this build
          const { data: sessionData, error: sessionError } = await (supabase.auth as any).getSessionFromUrl(res.url);
          if (sessionError) throw sessionError;
          
          if (sessionData.session?.user) {
            await verifyNotAdmin(sessionData.session.user.id);
          }
        }
      }
    } catch (error: any) {
      console.error("GOOGLE LOGIN ERROR:", error);
      Alert.alert("Google Login Failed", error.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email address first.");
      return;
    }

    setLoading(true);
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
      setLoading(false);
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
            onPress={() => view === "forgot" ? setView("login") : router.back()} 
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
                  editable={!loading}
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
                    editable={!loading}
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
                  disabled={loading}
                  className="w-full h-14 bg-[#0A1D37] rounded-xl flex-row justify-center items-center"
                >
                  {loading ? <ActivityIndicator color="white" className="mr-2" /> : null}
                  <Text className="text-white text-base font-bold">
                    {loading ? "Logging in..." : "Log In"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleMagicLink}
                  disabled={loading}
                  className="w-full h-14 border-2 border-blue-600 bg-blue-50/50 rounded-xl mt-3 flex-row justify-center items-center"
                >
                  <Text className="text-blue-600 text-base font-bold">
                    Email me a Magic Link (OTP)
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
                disabled={loading}
                className="w-full h-14 border border-slate-300 rounded-xl flex-row justify-center items-center bg-white shadow-sm"
              >
                {loading ? <ActivityIndicator color="#000" className="mr-2" /> : null}
                <Image source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" }} className="w-5 h-5 mr-3" />
                <Text className="text-slate-700 text-base font-bold">
                  Continue with Google
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
                  editable={!loading}
                />
              </View>

              <TouchableOpacity
                onPress={handleResetPassword}
                disabled={loading}
                className="w-full h-14 bg-[#0A1D37] rounded-xl mt-4 flex-row justify-center items-center"
              >
                {loading ? <ActivityIndicator color="white" className="mr-2" /> : null}
                <Text className="text-white text-base font-bold">
                  {loading ? "Sending link..." : "Send Reset Link"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
