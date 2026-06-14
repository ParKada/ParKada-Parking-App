import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Modal } from "react-native";
import { useRouter } from "expo-router";
import { Eye, EyeOff, ArrowLeft, CheckCircle2, ChevronDown } from "lucide-react-native";
import { Picker } from '@react-native-picker/picker';
import Checkbox from 'expo-checkbox';
import { supabase } from "../../lib/supabase";

const ALLOWED_CAR_BRANDS = [
  "Audi", "BMW", "BYD", "Changan", "Chery", "Chevrolet", "Dodge", "Dongfeng", "Ford", "Foton", "GAC Motor", "Geely", "GWM", 
  "Honda", "Hyundai", "Isuzu", "Jaecoo", "Jaguar", "Jeep", "Jetour", "Kia", "Land Rover", "Lexus", "Mahindra", "Mazda", "Mercedes-Benz", 
  "MG", "Mini", "Mitsubishi", "Nissan", "Omoda", "Peugeot", "Porsche", "Subaru", "Suzuki", "Tata", "Toyota", "Volkswagen", "Volvo", "Wuling"
];

const PH_MOBILE_REGEX = /^09\d{9}$/;

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [plateNumber, setPlateNumber] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [agreeTc, setAgreeTc] = useState(false);

  const [otpCode, setOtpCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  const [resendCount, setResendCount] = useState(0);

  const RESEND_TIMER_START_AFTER = 1;

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const checkExistingUser = async () => {
    const { data: existingUser, error } = await supabase
      .from("profiles")
      .select("email, phone_number")
      .or(`email.eq.${email},phone_number.eq.${phoneNumber}`);

    if (error) throw error;
    
    if (existingUser && existingUser.length > 0) {
      const emailExists = existingUser.some(user => user.email === email);
      const phoneExists = existingUser.some(user => user.phone_number === phoneNumber);
      
      if (emailExists && phoneExists) throw new Error("Both email and phone number are already registered.");
      if (emailExists) throw new Error("Email is already registered. Please use a different email.");
      if (phoneExists) throw new Error("Phone number is already registered. Please use a different number.");
    }
    return false;
  };

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return "";
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>\-_\+=]/.test(pwd);
    const hasMinLength = pwd.length >= 8;

    if (hasMinLength && hasLower && hasUpper && hasNumber && hasSpecial) return "Very Strong Password";
    if (hasMinLength && ((hasLower && hasUpper) || (hasLower && hasNumber) || (hasUpper && hasNumber))) return "Strong Password";
    return "Weak Password";
  };

  const handleNextStep = async () => {
    if (!fullName || !email || !phoneNumber || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all personal details.");
      return;
    }
    if (!PH_MOBILE_REGEX.test(phoneNumber)) {
      Alert.alert("Error", "Please enter a valid Philippine mobile number (e.g., 09XXXXXXXXX).");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }
    if (getPasswordStrength(password) !== "Very Strong Password") {
      Alert.alert("Error", "Password must be Very Strong (at least 8 chars, uppercase, lowercase, number, and special character).");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await checkExistingUser();
      setStep(2);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (skipVehicle = false) => {
    if (!skipVehicle) {
      if (!plateNumber || !vehicleBrand || !vehicleModel || !vehicleColor) {
        Alert.alert("Error", "Please fill in all vehicle details or select Skip.");
        return;
      }
      const plateRegex = /^[A-Z]{3}[\s-]?[0-9]{3,4}$/i;
      if (!plateRegex.test(plateNumber.trim())) {
        Alert.alert("Error", "Invalid Plate Number. Must be LTO standard (e.g., ABC 123 or ABC 1234).");
        return;
      }
    }

    if (!agreeTc) {
      Alert.alert("Error", "Please agree to the Terms & Conditions and Privacy Policy.");
      return;
    }

    setLoading(true);
    try {
      await checkExistingUser();
      
      const { error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: { data: { full_name: fullName, phone_number: phoneNumber } }
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          Alert.alert("Info", "Account already exists. Sending you to OTP verification.");
          await handleResendOtp(true);
          setStep(3);
          return;
        }
        throw authError;
      }

      Alert.alert("Success", "Verification code sent to your email!");
      setStep(3);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to register. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async (isSilent = false) => {
    if (countdown > 0 && !isSilent) {
      Alert.alert("Wait", `Please wait ${Math.ceil(countdown / 60)} minutes before requesting a new code.`);
      return;
    }
    
    if (!isSilent) setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });
      
      if (error) {
        if (error.message.includes("User already confirmed")) {
          Alert.alert("Error", "This email is already verified. Please login.");
          router.replace("/(auth)/login");
          return;
        }
        throw new Error(error.message || "Unable to resend code. Please try again later.");
      }
      
      if (!isSilent) {
        const newResendCount = resendCount + 1;
        setResendCount(newResendCount);
        if (newResendCount >= RESEND_TIMER_START_AFTER) {
          setCountdown(120);
        }
        Alert.alert("Success", "New verification code sent to your email!");
      }
    } catch (error: any) {
      if (!isSilent) {
        Alert.alert("Error", error.message || "Failed to resend code. Please wait a moment and try again.");
      }
    } finally {
      if (!isSilent) setResending(false);
    }
  };

  const handleVerifyOtpAndSave = async () => {
    if (lockoutTime && Date.now() < lockoutTime) {
      const remainingMins = Math.ceil((lockoutTime - Date.now()) / 60000);
      Alert.alert("Locked", `Too many attempts. Please try again in ${remainingMins} minutes.`);
      return;
    }

    if (otpCode.length !== 8) {
      Alert.alert("Error", "Please enter the 8-digit code.");
      return;
    }

    setLoading(true);
    try {
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'signup'
      });

      if (verifyError) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= 5) {
          setLockoutTime(Date.now() + 15 * 60 * 1000);
          throw new Error("Maximum attempts reached. Locked for 15 minutes.");
        }
        throw new Error(`Invalid code. ${5 - newAttempts} attempts remaining.`);
      }

      setAttempts(0);
      const userId = verifyData.user?.id;
      if (!userId) throw new Error("Verification failed. User ID not found.");

      const { error: profileError } = await supabase.from("profiles").insert([{
        id: userId,
        email: email,
        first_name: fullName.split(' ')[0],
        last_name: fullName.split(' ').slice(1).join(' '),
        phone_number: phoneNumber,
        user_type: "driver"
      }]);
      
      if (profileError) {
        if (profileError.code === '23505') {
          // Ignore if profile already exists
        } else {
          throw new Error("Failed to save profile details.");
        }
      }

      if (plateNumber) {
        await supabase.from("vehicles").insert([{
          profile_id: userId,
          plate_number: plateNumber.toUpperCase(),
          vehicle_type: "4-wheel",
          brand: vehicleBrand,
          color: vehicleColor,
          is_active: true
        }]);
      }

      setStep(4);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Invalid or expired code.");
      setOtpCode("");
    } finally {
      setLoading(false);
    }
  };

  const isLocked = lockoutTime !== null && Date.now() < lockoutTime;

  if (showTerms) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-row items-center border-b border-slate-200 px-4 py-4 pt-12">
          <TouchableOpacity onPress={() => setShowTerms(false)} className="p-2 mr-2 rounded-full bg-slate-100">
            <ArrowLeft size={20} color="#1E293B" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-slate-900">Terms & Privacy Policy</Text>
        </View>
        <ScrollView className="p-6">
          <Text className="text-sm text-slate-700 leading-relaxed">
            Placeholder for Terms & Conditions. By using ParKada, you agree that reservations are non-refundable and strictly for 4-wheeled vehicles.
          </Text>
        </ScrollView>
      </View>
    );
  }

  if (step === 4) {
    return (
      <View className="flex-1 bg-slate-100 items-center justify-center p-6">
        <View className="bg-white w-full rounded-[40px] p-8 items-center shadow-xl">
          <View className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 size={40} color="#16A34A" />
          </View>
          <Text className="text-2xl font-extrabold mb-2 text-slate-900">Account Created!</Text>
          <Text className="text-slate-500 text-sm mb-2 text-center leading-relaxed">
            Welcome to ParKada. Your account is currently under <Text className="text-amber-500 font-bold">Unverified (Basic) Status</Text>.
          </Text>
          <Text className="text-slate-500 text-sm mb-8 text-center leading-relaxed">
            You can verify your account later in the app settings to unlock full features.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace("/(app)")}
            className="w-full h-14 bg-[#0A1D37] rounded-xl flex items-center justify-center"
          >
            <Text className="text-white text-base font-bold">Start Parking</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-white">
      <View className="bg-[#0A1D37] px-6 pt-12 pb-8 rounded-b-[40px] shadow-lg">
        <TouchableOpacity 
          onPress={() => { if (step === 3) setStep(2); else if (step === 2) setStep(1); else router.back(); }} 
          className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mb-6"
        >
          <ArrowLeft size={20} color="white" />
        </TouchableOpacity>
        <Text className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">
          Step {step} of 3 — {step === 1 ? "Personal Info" : step === 2 ? "Vehicle Details" : "Verify Email"}
        </Text>
        <Text className="text-3xl font-extrabold tracking-tight mb-4 text-white">
          {step === 1 ? "Create Account" : step === 2 ? "Add Your Vehicle" : "Enter OTP Code"}
        </Text>
        <View className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
          <View className="bg-amber-400 h-full rounded-full" style={{ width: step === 1 ? '33%' : step === 2 ? '66%' : '100%' }} />
        </View>
      </View>

      <ScrollView className="flex-1 px-6 py-6" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>
        {step === 1 && (
          <View className="space-y-4 flex-col gap-4">
            <View>
              <Text className="text-sm font-bold text-slate-800 mb-1.5">Full Name</Text>
              <TextInput value={fullName} onChangeText={setFullName} placeholder="Juan dela Cruz" className="w-full h-14 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-800 mb-1.5">Email Address</Text>
              <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="juan@example.com" className="w-full h-14 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-800 mb-1.5">Contact Number</Text>
              <TextInput value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="numeric" maxLength={11} placeholder="09XXXXXXXXX" className="w-full h-14 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-800 mb-1.5">Password</Text>
              <View className="relative justify-center">
                <TextInput secureTextEntry={!showPassword} value={password} onChangeText={setPassword} placeholder="Min. 8 characters" className="w-full h-14 pl-4 pr-12 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="absolute right-4"><Eye size={20} color="#94a3b8" /></TouchableOpacity>
              </View>
              {password ? (
                <Text className={`mt-1 text-xs font-semibold ${
                  getPasswordStrength(password) === "Very Strong Password" ? "text-emerald-600" :
                  getPasswordStrength(password) === "Strong Password" ? "text-amber-500" : "text-rose-500"
                }`}>
                  {getPasswordStrength(password)}
                </Text>
              ) : null}
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-800 mb-1.5">Confirm Password</Text>
              <View className="relative justify-center">
                <TextInput secureTextEntry={!showConfirmPassword} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-type your password" className="w-full h-14 pl-4 pr-12 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4"><Eye size={20} color="#94a3b8" /></TouchableOpacity>
              </View>
              {confirmPassword ? (
                <Text className={`mt-1 text-xs font-semibold ${password === confirmPassword ? 'text-emerald-600' : 'text-amber-500'}`}>
                  {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={handleNextStep} disabled={loading} className="w-full h-14 bg-[#0A1D37] rounded-xl flex-row items-center justify-center mt-4">
              {loading && <ActivityIndicator color="white" className="mr-2" />}
              <Text className="text-white font-bold">Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View className="space-y-4 flex-col gap-4">
            <Text className="text-sm text-slate-500 mb-2">Register your 4-wheel vehicle for verification. No motorcycles allowed.</Text>
            <View>
              <Text className="text-sm font-bold text-slate-800 mb-1.5">Plate Number</Text>
              <TextInput value={plateNumber} onChangeText={setPlateNumber} autoCapitalize="characters" placeholder="ABC 1234" className="w-full h-14 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-800 mb-1.5">Car Brand</Text>
              <TouchableOpacity 
                onPress={() => setShowBrandModal(true)}
                className="w-full h-14 px-4 rounded-xl bg-slate-50 border border-slate-200 flex-row items-center justify-between"
              >
                <Text className={vehicleBrand ? "text-slate-800 text-sm" : "text-slate-400 text-sm"}>
                  {vehicleBrand || "Select Brand"}
                </Text>
                <ChevronDown size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-800 mb-1.5">Specific Model</Text>
              <TextInput value={vehicleModel} onChangeText={setVehicleModel} placeholder="e.g. Vios" editable={!!vehicleBrand} className="w-full h-14 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-800 mb-1.5">Vehicle Color</Text>
              <TextInput value={vehicleColor} onChangeText={setVehicleColor} placeholder="e.g. White" className="w-full h-14 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
            </View>
            <View className="flex-row items-center gap-3 mt-2 pr-4">
              <Checkbox value={agreeTc} onValueChange={setAgreeTc} color={agreeTc ? '#0A1D37' : undefined} />
              <Text className="text-xs text-slate-600">I agree to the <Text onPress={() => setShowTerms(true)} className="font-bold text-blue-600">Terms & Conditions</Text>.</Text>
            </View>
            <TouchableOpacity onPress={() => handleSendOtp(false)} disabled={loading} className="w-full h-14 bg-[#0A1D37] rounded-xl flex-row items-center justify-center mt-4">
              {loading && <ActivityIndicator color="white" className="mr-2" />}
              <Text className="text-white font-bold">Continue</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => handleSendOtp(true)} disabled={loading} className="mt-4 items-center">
              <Text className="text-slate-500 font-semibold text-sm">Skip this for now</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View className="space-y-6 flex-col gap-6 items-center pt-8">
            <View className="items-center">
              <Text className="text-xl font-bold text-slate-900 mb-2">Check your email</Text>
              <Text className="text-sm text-slate-500 text-center">We've sent an 8-digit verification code to{"\n"}<Text className="font-bold text-slate-800">{email}</Text></Text>
            </View>
            <View className="w-full relative justify-center">
              <TextInput value={otpCode} onChangeText={setOtpCode} keyboardType="number-pad" maxLength={8} className="w-full h-14 text-center tracking-[10px] font-bold text-2xl bg-slate-50 border border-slate-300 rounded-xl" editable={!isLocked && !loading} />
            </View>
            <View className="w-full items-center">
              {countdown > 0 ? (
                <Text className="text-slate-500 font-medium">Resend code in <Text className="text-blue-600">{Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}</Text></Text>
              ) : (
                <TouchableOpacity onPress={() => handleResendOtp(false)} disabled={resending || isLocked}>
                  <Text className="text-blue-600 font-bold">{resending ? "Resending..." : "Resend Code"}</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={handleVerifyOtpAndSave} disabled={loading || otpCode.length !== 8 || isLocked} className="w-full h-14 bg-[#0A1D37] rounded-xl flex-row items-center justify-center mt-4 opacity-90">
              {loading && <ActivityIndicator color="white" className="mr-2" />}
              <Text className="text-white font-bold">Verify & Create Account</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={showBrandModal} animationType="slide" transparent={true} onRequestClose={() => setShowBrandModal(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl h-[60%] p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-slate-900">Select Car Brand</Text>
              <TouchableOpacity onPress={() => setShowBrandModal(false)} className="bg-slate-100 px-4 py-2 rounded-full">
                <Text className="text-slate-500 font-bold text-xs">Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {ALLOWED_CAR_BRANDS.map(brand => (
                <TouchableOpacity 
                  key={brand} 
                  onPress={() => { setVehicleBrand(brand); setShowBrandModal(false); }}
                  className={`p-4 border-b border-slate-100 ${vehicleBrand === brand ? 'bg-blue-50' : ''}`}
                >
                  <Text className={`text-base ${vehicleBrand === brand ? 'text-blue-700 font-bold' : 'text-slate-700'}`}>{brand}</Text>
                </TouchableOpacity>
              ))}
              <View className="h-10" />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
