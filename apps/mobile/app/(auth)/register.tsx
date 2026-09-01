import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { Eye, EyeOff, ArrowLeft, CheckCircle2, ChevronDown, X, Search } from "lucide-react-native";
import Checkbox from 'expo-checkbox';
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

const ALLOWED_CAR_BRANDS = [
  "Audi", "BMW", "BYD", "Changan", "Chery", "Chevrolet", "Dodge", "Dongfeng", "Ford", "Foton", "GAC Motor", "Geely", "GWM", 
  "Honda", "Hyundai", "Isuzu", "Jaecoo", "Jaguar", "Jeep", "Jetour", "Kia", "Land Rover", "Lexus", "Mahindra", "Mazda", "Mercedes-Benz", 
  "MG", "Mini", "Mitsubishi", "Nissan", "Omoda", "Peugeot", "Porsche", "Subaru", "Suzuki", "Tata", "Toyota", "Volkswagen", "Volvo", "Wuling"
];

const PH_MOBILE_REGEX = /^09\d{9}$/;
const LTO_PLATE_REGEX = /^[A-Z]{2,3}\s?[0-9]{3,4}$/i;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function RegisterPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);
  const [showTerms, setShowTerms] = useState<boolean>(false);

  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const [plateNumber, setPlateNumber] = useState<string>("");
  const [vehicleBrand, setVehicleBrand] = useState<string>("");
  const [showBrandModal, setShowBrandModal] = useState<boolean>(false);
  const [brandSearchQuery, setBrandSearchQuery] = useState<string>("");
  const [vehicleModel, setVehicleModel] = useState<string>("");
  const [vehicleColor, setVehicleColor] = useState<string>("");
  const [agreeTc, setAgreeTc] = useState<boolean>(false);

  // --- TOUCHED STATES ---
  const [emailTouched, setEmailTouched] = useState<boolean>(false);
  const [phoneTouched, setPhoneTouched] = useState<boolean>(false);
  const [plateTouched, setPlateTouched] = useState<boolean>(false);

  const [otpCode, setOtpCode] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(0);
  const [attempts, setAttempts] = useState<number>(0);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  const [resendCount, setResendCount] = useState<number>(0);

  const RESEND_TIMER_START_AFTER = 1;

  const getCleanEmail = () => email.trim().toLowerCase();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const filteredBrands = ALLOWED_CAR_BRANDS.filter((brand) =>
    brand.toLowerCase().includes(brandSearchQuery.toLowerCase().trim())
  );

  const checkExistingUser = async () => {
    const cleanEmail = getCleanEmail();
    const cleanPhone = phoneNumber.trim();

    const { data: existingUser, error } = await supabase
      .from("profiles")
      .select("email, phone_number")
      .or(`email.ilike.${cleanEmail},phone_number.eq.${cleanPhone}`);

    if (error) {
      console.error("User validation check failed:", error.message);
    }

    if (existingUser && existingUser.length > 0) {
      const emailExists = existingUser.some(
        (user) => user.email?.toLowerCase() === cleanEmail
      );
      const phoneExists = existingUser.some(
        (user) => user.phone_number === cleanPhone
      );

      if (emailExists && phoneExists) {
        throw new Error("Both Email Address and Phone Number are already registered.");
      }
      if (emailExists) {
        throw new Error("This Email Address is already registered. Please use another email or log in.");
      }
      if (phoneExists) {
        throw new Error("This Phone Number is already registered to another account.");
      }
    }
  };

  const checkExistingPlate = async (formattedPlate: string) => {
    if (!formattedPlate) return;
    const { data: existingPlate, error } = await supabase
      .from("vehicles")
      .select("plate_number")
      .eq("plate_number", formattedPlate);

    if (error) return; 
    if (existingPlate && existingPlate.length > 0) {
      throw new Error("This Plate Number is already registered to another account.");
    }
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

  const isEmailValid = EMAIL_REGEX.test(getCleanEmail());
  const isPhoneValid = PH_MOBILE_REGEX.test(phoneNumber.trim());
  const isPlateValid = LTO_PLATE_REGEX.test(plateNumber.toUpperCase().trim());

  const isStep1Valid = Boolean(
    fullName.trim() &&
    isEmailValid &&
    isPhoneValid
  );

  const handleNextStep = async () => {
    setEmailTouched(true);
    setPhoneTouched(true);

    if (!fullName.trim() || !email.trim() || !phoneNumber.trim() || !password || !confirmPassword) {
      Alert.alert("Incomplete Details", "Please fill in all personal information fields.");
      return;
    }

    if (!isEmailValid) {
      Alert.alert("Invalid Email Address", "Please input a valid email address format (e.g. name_123@domain.com).");
      return;
    }

    if (!isPhoneValid) {
      Alert.alert("Invalid Phone Number", "Please enter a valid 11-digit Philippine mobile number starting with 09 (e.g., 09123456789).");
      return;
    }

    if (getPasswordStrength(password) !== "Very Strong Password") {
      Alert.alert("Weak Password", "Password must contain at least 8 characters, with uppercase, lowercase, number, and special character.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match. Please verify your password entry.");
      return;
    }

    setLoading(true);
    try {
      await checkExistingUser();
      setStep(2);
    } catch (error: any) {
      Alert.alert("Account Exists", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setPlateTouched(true);
    const formattedPlate = plateNumber.toUpperCase().trim();
    const cleanEmail = getCleanEmail();

    if (!plateNumber.trim() || !vehicleBrand || !vehicleModel.trim() || !vehicleColor.trim()) {
      Alert.alert("Vehicle Details Required", "Please fill in all mandatory vehicle details to continue.");
      return;
    }
    
    if (!isPlateValid) {
      Alert.alert("Invalid Plate Number", "Please input a valid LTO plate number format (e.g., ABC 123 or ABC 1234).");
      return;
    }

    if (!agreeTc) {
      Alert.alert("Terms & Conditions Required", "Please accept the Terms & Conditions and Privacy Policy to proceed.");
      return;
    }

    setLoading(true);
    try {
      await checkExistingUser();
      await checkExistingPlate(formattedPlate);

      const { error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: { data: { full_name: fullName.trim(), phone_number: phoneNumber.trim() } }
      });

      if (authError) {
        if (authError.message.toLowerCase().includes("already registered") || authError.message.toLowerCase().includes("user already exists")) {
          Alert.alert("Account Exists", "This email address is already registered. Please log in instead.");
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
        email: getCleanEmail(),
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
    const cleanEmail = getCleanEmail();

    try {
      // 1. Verify OTP
      let verifyRes = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: otpCode.trim(),
        type: 'email'
      });

      if (verifyRes.error) {
        verifyRes = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: otpCode.trim(),
          type: 'signup'
        });
      }

      if (verifyRes.error) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= 5) {
          setLockoutTime(Date.now() + 15 * 60 * 1000);
          throw new Error("Maximum attempts reached. Locked for 15 minutes.");
        }
        throw new Error(`Invalid code. ${5 - newAttempts} attempts remaining.`);
      }

      setAttempts(0);
      const userId = verifyRes.data.user?.id || verifyRes.data.session?.user?.id;
      
      if (!userId) {
        throw new Error("Verification succeeded but active User Session was not found. Please try logging in.");
      }

      // 2. Insert Profile Data (UPSERT to avoid 23505 conflict)
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      const { error: profileError } = await supabase.from("profiles").upsert([
        {
          id: userId,
          email: cleanEmail,
          first_name: firstName,
          last_name: lastName,
          phone_number: phoneNumber.trim(),
          user_type: "driver",
          verification_status: "unverified",
          discount_type: "regular"
        }
      ], { onConflict: 'id' });

      if (profileError) {
        console.error("Profile saving error:", profileError);
        throw new Error(`Profile save failed: ${profileError.message}`);
      }

      // 3. Insert Vehicle Data (UPSERT to avoid duplication)
      const fullBrand = `${vehicleBrand} ${vehicleModel.trim()}`.trim();

const { error: vehicleError } = await supabase.from("vehicles").upsert([
  {
    profile_id: userId,
    plate_number: plateNumber.toUpperCase().trim(),
    vehicle_type: "4-wheel",
    brand: fullBrand, // Isasave bilang Halimbawa: "Toyota Vios"
    color: vehicleColor.trim(),
    is_active: true
  }
], { onConflict: 'plate_number' });

      if (vehicleError) {
        console.error("Vehicle saving error:", vehicleError);
        throw new Error(`Vehicle save failed: ${vehicleError.message}`);
      }

      // 4. Prompt Successful Message & Direct Redirect to Home Page
      Alert.alert(
        "Registration Successful! 🎉",
        "Your account and vehicle have been registered successfully. Welcome to ParKada!",
        [
          {
            text: "Start Parking",
            onPress: () => router.replace("/(app)")
          }
        ],
        { cancelable: false }
      );

    } catch (error: any) {
      Alert.alert("Registration Failed", error.message || "An error occurred while saving your data.");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTerms = () => {
    setAgreeTc(true);
    setShowTerms(false);
  };

  const isLocked = lockoutTime !== null && Date.now() < lockoutTime;

  if (showTerms) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-row items-center border-b border-slate-200 px-4 py-4 pt-12 bg-white z-10 shadow-sm">
          <TouchableOpacity onPress={() => setShowTerms(false)} className="p-2 mr-2 rounded-full bg-slate-100">
            <ArrowLeft size={20} color="#1E293B" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-slate-900">Terms & Privacy Policy</Text>
        </View>
        <KeyboardAwareScrollView className="p-6">
          <View className="space-y-6 pb-28">
            <View className="space-y-2">
              <Text className="text-2xl font-extrabold text-[#0A1D37]">Terms of Service</Text>
              <Text className="text-xs text-slate-400 font-medium">Last Updated: August 2026</Text>
              <Text className="text-sm text-slate-700 leading-relaxed pt-2">
                Welcome to <Text className="font-bold text-[#0A1D37]">ParKada</Text>. By creating an account and using our parking reservation platform, you agree to comply with and be bound by the following terms and conditions.
              </Text>
            </View>

            <View className="space-y-1.5">
              <Text className="text-base font-bold text-slate-800">1. Eligible Vehicles</Text>
              <Text className="text-sm text-slate-600 leading-relaxed">
                ParKada strictly serves <Text className="font-semibold text-slate-800">4-wheeled vehicles only</Text> (Sedans, SUVs, Vans, Pickups). Motorcycles and heavy commercial trucks exceeding standard slot dimensions are strictly prohibited.
              </Text>
            </View>

            <View className="space-y-1.5">
              <Text className="text-base font-bold text-slate-800">2. Mandatory Vehicle Registration</Text>
              <Text className="text-sm text-slate-600 leading-relaxed">
                Every user profile must be linked to at least one (1) registered 4-wheel vehicle upon sign-up. The Plate Number and details provided will serve as the primary identity for automated gate entry, spot allocation, and barrier validation.
              </Text>
            </View>

            <View className="space-y-1.5">
              <Text className="text-base font-bold text-slate-800">3. Senior Citizen & PWD Discount Policy</Text>
              <Text className="text-sm text-slate-600 leading-relaxed">
                Senior Citizen and PWD discounts are <Text className="font-bold text-slate-800">strictly exclusive to account holders who are the REGISTERED DRIVERS</Text> operating their assigned vehicle. Discounts will not apply to non-driver passengers. To prevent abuse, discount status is locked to <Text className="font-semibold text-slate-800">one (1) approved Driver's License and Plate Number</Text>.
              </Text>
            </View>

            <View className="space-y-1.5">
              <Text className="text-base font-bold text-slate-800">4. Reservation & Non-Refundability Policy</Text>
              <Text className="text-sm text-slate-600 leading-relaxed">
                All parking slot reservations made through ParKada are <Text className="font-semibold text-rose-600">final and non-refundable</Text>. Once a payment or slot confirmation is processed, cancellations or change-of-mind refunds will not be accommodated under any circumstances.
              </Text>
            </View>

            <View className="space-y-1.5">
              <Text className="text-base font-bold text-slate-800">5. Parking Facility Rules & Liability</Text>
              <Text className="text-sm text-slate-600 leading-relaxed">
                Users are required to follow designated parking slots, entry/exit guidelines, and speed limits inside parking premises. ParKada is not liable for loss, damage, theft, or natural hazards involving vehicles or property left inside parking facilities.
              </Text>
            </View>

            <View className="pt-4 border-t border-slate-100 space-y-2">
              <Text className="text-2xl font-extrabold text-[#0A1D37]">Privacy Policy</Text>
              <Text className="text-sm text-slate-700 leading-relaxed">
                ParKada values your privacy and is committed to protecting your personal data in accordance with Philippine Data Privacy Regulations (RA 10173).
              </Text>
            </View>

            <View className="space-y-1.5">
              <Text className="text-base font-bold text-slate-800">6. Information We Collect</Text>
              <Text className="text-sm text-slate-600 leading-relaxed">
                We collect your full name, email address, Philippine mobile number, Driver's License details, Government IDs (for Senior/PWD verification), and vehicle registration parameters (Plate Number, Brand, Color) to provide reservation and account identification services.
              </Text>
            </View>

            <View className="space-y-1.5">
              <Text className="text-base font-bold text-slate-800">7. Use of Data & Security Audits</Text>
              <Text className="text-sm text-slate-600 leading-relaxed">
                Your data is exclusively used for verifying parking slot access, processing OTP security authorizations, preventing fraudulent discount claims, and managing account statuses.
              </Text>
            </View>

            <TouchableOpacity 
              onPress={handleAcceptTerms} 
              className="w-full h-14 bg-[#0A1D37] rounded-xl flex items-center justify-center mt-8 mb-12 shadow-md"
            >
              <Text className="text-white font-bold text-base">I Understand & Accept</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <KeyboardAwareScrollView 
        contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, 12) }}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={10}
        extraHeight={10}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View>
          {/* Header Banner */}
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

          {/* Form Content */}
          <View className="px-6 py-6">
            {step === 1 && (
              <View className="space-y-4 flex-col gap-4">
                <View>
                  <Text className="text-sm font-bold text-slate-800 mb-1.5">Full Name</Text>
                  <TextInput value={fullName} onChangeText={setFullName} placeholder="Jec Lique" className="w-full h-14 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                </View>

                {/* EMAIL ADDRESS */}
                <View>
                  <Text className="text-sm font-bold text-slate-800 mb-1.5">Email Address</Text>
                  <TextInput 
                    value={email} 
                    onChangeText={setEmail}
                    onBlur={() => setEmailTouched(true)}
                    keyboardType="email-address" 
                    autoCapitalize="none" 
                    placeholder="jec_123@example.com" 
                    className={`w-full h-14 px-4 rounded-xl bg-slate-50 border text-sm ${
                      emailTouched && email && !isEmailValid ? "border-rose-500" : "border-slate-200"
                    }`} 
                  />
                  {emailTouched && email && !isEmailValid ? (
                    <Text className="text-xs font-semibold text-rose-500 mt-1">
                      Invalid Email Address (e.g., name_123@domain.com)
                    </Text>
                  ) : null}
                </View>

                {/* CONTACT NUMBER */}
                <View>
                  <Text className="text-sm font-bold text-slate-800 mb-1.5">Contact Number</Text>
                  <TextInput 
                    value={phoneNumber} 
                    onChangeText={setPhoneNumber} 
                    onBlur={() => setPhoneTouched(true)}
                    keyboardType="numeric" 
                    maxLength={11} 
                    placeholder="09XXXXXXXXX" 
                    className={`w-full h-14 px-4 rounded-xl bg-slate-50 border text-sm ${
                      phoneTouched && phoneNumber && !isPhoneValid ? "border-rose-500" : "border-slate-200"
                    }`} 
                  />
                  {phoneTouched && phoneNumber && !isPhoneValid ? (
                    <Text className="text-xs font-semibold text-rose-500 mt-1">
                      Please input valid contact number (11-digit starting with 09)
                    </Text>
                  ) : null}
                </View>

                <View>
                  <Text className="text-sm font-bold text-slate-800 mb-1.5">Password</Text>
                  <View className="relative justify-center">
                    <TextInput secureTextEntry={!showPassword} value={password} onChangeText={setPassword} placeholder="Min. 8 characters" className="w-full h-14 pl-4 pr-12 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="absolute right-4">
                      {showPassword ? <EyeOff size={20} color="#94a3b8" /> : <Eye size={20} color="#94a3b8" />}
                    </TouchableOpacity>
                  </View>
                  {password ? (
                    <View className="mt-2">
                      <View className="flex-row gap-1 mb-1.5">
                        <View className={`h-1.5 flex-1 rounded-full ${
                          getPasswordStrength(password) === "Weak Password" ? "bg-rose-500" : 
                          getPasswordStrength(password) === "Strong Password" || getPasswordStrength(password) === "Very Strong Password" ? "bg-emerald-500" : "bg-slate-200"
                        }`} />
                        <View className={`h-1.5 flex-1 rounded-full ${
                          getPasswordStrength(password) === "Strong Password" || getPasswordStrength(password) === "Very Strong Password" ? "bg-emerald-500" : "bg-slate-200"
                        }`} />
                        <View className={`h-1.5 flex-1 rounded-full ${
                          getPasswordStrength(password) === "Very Strong Password" ? "bg-emerald-500" : "bg-slate-200"
                        }`} />
                      </View>
                      <Text className={`text-xs font-semibold ${
                        getPasswordStrength(password) === "Very Strong Password" ? "text-emerald-600" :
                        getPasswordStrength(password) === "Strong Password" ? "text-amber-500" : "text-rose-500"
                      }`}>
                        {getPasswordStrength(password)}
                      </Text>
                      {getPasswordStrength(password) !== "Very Strong Password" && (
                        <Text className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                          Must contain 8+ chars, uppercase, lowercase, number, and special character.
                        </Text>
                      )}
                    </View>
                  ) : null}
                </View>

                <View>
                  <Text className="text-sm font-bold text-slate-800 mb-1.5">Confirm Password</Text>
                  <View className="relative justify-center">
                    <TextInput secureTextEntry={!showConfirmPassword} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-type your password" className="w-full h-14 pl-4 pr-12 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4">
                      {showConfirmPassword ? <EyeOff size={20} color="#94a3b8" /> : <Eye size={20} color="#94a3b8" />}
                    </TouchableOpacity>
                  </View>
                  {confirmPassword ? (
                    <Text className={`mt-1 text-xs font-semibold ${password === confirmPassword ? 'text-emerald-600' : 'text-amber-500'}`}>
                      {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                    </Text>
                  ) : null}
                </View>

                <TouchableOpacity 
                  onPress={handleNextStep} 
                  disabled={loading || !isStep1Valid} 
                  className={`w-full h-14 rounded-xl flex-row items-center justify-center mt-4 ${
                    isStep1Valid && !loading ? "bg-[#0A1D37]" : "bg-slate-300"
                  }`}
                >
                  {loading && <ActivityIndicator color="white" className="mr-2" />}
                  <Text className="text-white font-bold">Continue</Text>
                </TouchableOpacity>

                {/* ALREADY HAVE AN ACCOUNT LOGIN LINK (STEP 1 ONLY) */}
                <View className="flex-row items-center justify-center mt-3 mb-2">
                  <Text className="text-xs text-slate-500">Already have an account? </Text>
                  <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
                    <Text className="text-xs font-bold text-blue-600">Login</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {step === 2 && (
              <View className="space-y-4 flex-col gap-4">
                <Text className="text-sm text-slate-500 mb-2">Register your mandatory 4-wheel vehicle for verification. No motorcycles allowed.</Text>
                
                {/* PLATE NUMBER FIELD */}
                <View>
                  <Text className="text-sm font-bold text-slate-800 mb-1.5">Plate Number</Text>
                  <TextInput 
                    value={plateNumber} 
                    onChangeText={setPlateNumber} 
                    onBlur={() => setPlateTouched(true)}
                    autoCapitalize="characters" 
                    placeholder="ABC 1234" 
                    className={`w-full h-14 px-4 rounded-xl bg-slate-50 border text-sm ${
                      plateTouched && plateNumber && !isPlateValid ? "border-rose-500" : "border-slate-200"
                    }`} 
                  />
                  {plateTouched && plateNumber && !isPlateValid ? (
                    <Text className="text-xs font-semibold text-rose-500 mt-1">
                      Invalid LTO Plate Number format (e.g., ABC 123 or AB 1234).
                    </Text>
                  ) : null}
                </View>

                {/* CAR BRAND SELECTION BUTTON */}
                <View>
                  <Text className="text-sm font-bold text-slate-800 mb-1.5">Car Brand</Text>
                  <TouchableOpacity 
                    onPress={() => setShowBrandModal(true)}
                    className="w-full h-14 px-4 rounded-xl bg-slate-50 border border-slate-200 flex-row items-center justify-between"
                  >
                    <Text className={vehicleBrand ? "text-slate-800 text-sm font-medium" : "text-slate-400 text-sm"}>
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

                <View className="flex-row items-center gap-3 mt-2 ml-2 pl-2 pr-4">
                  <Checkbox value={agreeTc} onValueChange={setAgreeTc} color={agreeTc ? '#0A1D37' : undefined} />
                  <Text className="text-xs text-slate-600">I agree to the <Text onPress={() => setShowTerms(true)} className="font-bold text-blue-600">Terms & Conditions</Text>.</Text>
                </View>

                <TouchableOpacity onPress={handleSendOtp} disabled={loading} className="w-full h-14 bg-[#0A1D37] rounded-xl flex-row items-center justify-center mt-4">
                  {loading && <ActivityIndicator color="white" className="mr-2" />}
                  <Text className="text-white font-bold">Continue</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 3 && (
              <View className="space-y-6 flex-col gap-6 items-center pt-8">
                <View className="items-center">
                  <Text className="text-xl font-bold text-slate-900 mb-2">Check your email</Text>
                  <Text className="text-sm text-slate-500 text-center">We've sent an 8-digit verification code to{"\n"}<Text className="font-bold text-slate-800">{getCleanEmail()}</Text></Text>
                </View>

                <View className="w-full">
                  <TextInput 
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={8}
                    placeholder="12345678"
                    className="w-full h-16 rounded-2xl bg-slate-50 border border-slate-200 text-center text-2xl font-bold tracking-[10px] text-slate-800"
                  />
                </View>

                <TouchableOpacity 
                  onPress={handleVerifyOtpAndSave}
                  disabled={loading || isLocked || otpCode.length !== 8}
                  className={`w-full h-14 rounded-xl flex-row items-center justify-center ${
                    otpCode.length === 8 && !loading && !isLocked ? "bg-[#0A1D37]" : "bg-slate-300"
                  }`}
                >
                  {loading && <ActivityIndicator color="white" className="mr-2" />}
                  <Text className="text-white font-bold">Verify & Create Account</Text>
                </TouchableOpacity>

                <View className="flex-row items-center gap-2">
                  <Text className="text-xs text-slate-500">Didn't receive code?</Text>
                  <TouchableOpacity onPress={() => handleResendOtp(false)} disabled={resending || countdown > 0}>
                    <Text className={`text-xs font-bold ${countdown > 0 ? "text-slate-400" : "text-blue-600"}`}>
                      {resending ? "Sending..." : countdown > 0 ? `Resend in ${countdown}s` : "Resend Code"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </KeyboardAwareScrollView>

      {/* CAR BRAND SELECTOR MODAL */}
      <Modal
        visible={showBrandModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBrandModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-[32px] max-h-[80%] min-h-[50%] p-6">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-4 border-b border-slate-100">
              <Text className="text-lg font-bold text-slate-900">Select Vehicle Brand</Text>
              <TouchableOpacity 
                onPress={() => {
                  setShowBrandModal(false);
                  setBrandSearchQuery("");
                }}
                className="p-1 rounded-full bg-slate-100"
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View className="flex-row items-center bg-slate-100 rounded-xl px-3 my-4 h-12">
              <Search size={18} color="#94a3b8" className="mr-2" />
              <TextInput
                value={brandSearchQuery}
                onChangeText={setBrandSearchQuery}
                placeholder="Search car brand..."
                className="flex-1 text-sm text-slate-800 h-full"
                placeholderTextColor="#94a3b8"
              />
              {brandSearchQuery ? (
                <TouchableOpacity onPress={() => setBrandSearchQuery("")}>
                  <X size={16} color="#94a3b8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Brand List */}
            <FlatList
              data={filteredBrands}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setVehicleBrand(item);
                    setShowBrandModal(false);
                    setBrandSearchQuery("");
                  }}
                  className={`py-3.5 px-4 rounded-xl flex-row items-center justify-between my-0.5 ${
                    vehicleBrand === item ? "bg-slate-100" : "active:bg-slate-50"
                  }`}
                >
                  <Text className={`text-base ${vehicleBrand === item ? "font-bold text-[#0A1D37]" : "text-slate-700"}`}>
                    {item}
                  </Text>
                  {vehicleBrand === item && <CheckCircle2 size={18} color="#0A1D37" />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <View className="py-8 items-center justify-center">
                  <Text className="text-slate-400 text-sm">No brand found matching "{brandSearchQuery}"</Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}