import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Eye, EyeOff, ArrowLeft } from "lucide-react-native";
import { supabase } from "../../lib/supabase";

const BG_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663457633559/7LbcgdNcQ8vnZSarPg7jeB/iparkbayan-mobile-bg-8Wgq9qnQX7R8Lyxjz9xWvm.webp";

export default function LoginPage() {
  const router = useRouter();
  
  const [view, setView] = useState<"login" | "forgot">("login");
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

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

      const userId = authData.user?.id;

      if (userId) {
        const { data: adminData } = await supabase
          .from('admin_profiles')
          .select('id')
          .eq('id', userId)
          .single();

        if (adminData) {
          await supabase.auth.signOut();
          throw new Error("Access Denied: Admin accounts cannot use the Driver App. Please log in via the Admin Portal.");
        }

        Alert.alert("Success", "Login successful! Welcome back.");
        router.replace("/"); 
      }
    } catch (error: any) {
      console.error("LOGIN ERROR:", error);
      Alert.alert("Login Failed", error.message || "Invalid login credentials.");
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
              {view === "login" ? "Sign In" : "Reset Password"}
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

              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                className="w-full h-14 bg-[#0A1D37] rounded-xl mt-4 flex-row justify-center items-center"
              >
                {loading ? <ActivityIndicator color="white" className="mr-2" /> : null}
                <Text className="text-white text-base font-bold">
                  {loading ? "Signing in..." : "Sign In"}
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
