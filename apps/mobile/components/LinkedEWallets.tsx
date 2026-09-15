import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import {
  Wallet,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle2,
  Trash2,
  ShieldCheck,
  AlertCircle,
  Info,
} from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { notifyWalletLinked, notifyWalletUnlinked } from "../lib/notify";

/**
 * ============================================================================
 *  LINKED E-WALLETS — SIMULATED
 * ============================================================================
 *  This is a functional simulation for the ParKada thesis system. It does NOT
 *  call the GCash or Maya APIs, does not authenticate against either provider,
 *  and stores no payment credentials — only the provider name and the mobile
 *  number the user typed, so the app can show which wallet is "linked".
 *
 *  Every screen in the flow says so plainly, so a demo audience is never misled
 *  into thinking a real transaction or authentication took place.
 *
 *  Table (see supabase/parkada_updates.sql):
 *    linked_wallets(id, profile_id, provider, mobile_number, account_name,
 *                   is_default, linked_at)
 *    unique (profile_id, provider, mobile_number)
 * ============================================================================
 */

export const LINKED_WALLETS_TABLE = "linked_wallets";

type Provider = "gcash" | "maya";

type LinkedWallet = {
  id: string;
  provider: Provider;
  mobile_number: string;
  account_name?: string | null;
  is_default?: boolean | null;
  linked_at?: string | null;
};

type Step = "list" | "provider" | "number" | "confirm" | "verifying" | "success";

const PROVIDERS: Record<
  Provider,
  { name: string; initial: string; accent: string; chipBg: string; chipText: string; blurb: string }
> = {
  gcash: {
    name: "GCash",
    initial: "G",
    accent: "#2563eb",
    chipBg: "bg-blue-50",
    chipText: "text-blue-700",
    blurb: "Pay for reservations using your GCash mobile number.",
  },
  maya: {
    name: "Maya",
    initial: "M",
    accent: "#059669",
    chipBg: "bg-emerald-50",
    chipText: "text-emerald-700",
    blurb: "Pay for reservations using your Maya mobile number.",
  },
};

/* -------------------------------------------------------------------------- */
/*  NUMBER HELPERS                                                             */
/* -------------------------------------------------------------------------- */

/** Strip everything that is not a digit. */
const digitsOnly = (value: string) => value.replace(/\D/g, "");

/**
 * Normalise a Philippine mobile number to the 11-digit 09XXXXXXXXX form.
 * Accepts 09XXXXXXXXX, +639XXXXXXXXX, 639XXXXXXXXX and 9XXXXXXXXX.
 * Returns null when the input cannot be a valid PH mobile number.
 */
export function normalizePhMobile(raw: string): string | null {
  let digits = digitsOnly(raw);

  if (digits.startsWith("63") && digits.length === 12) digits = `0${digits.slice(2)}`;
  else if (digits.startsWith("9") && digits.length === 10) digits = `0${digits}`;

  if (digits.length !== 11) return null;
  if (!digits.startsWith("09")) return null;
  return digits;
}

/** Live formatting while typing: 0917 123 4567 */
export function formatPhMobile(raw: string): string {
  const digits = digitsOnly(raw).slice(0, 11);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

/** Masked display: 09XX XXX 4567 */
export function maskPhMobile(raw: string): string {
  const digits = digitsOnly(raw);
  if (digits.length < 4) return "09XX XXX XXXX";
  return `09XX XXX ${digits.slice(-4)}`;
}

function isMissingTableError(error: any) {
  return error?.code === "42P01" || /does not exist/i.test(error?.message ?? "");
}

/* -------------------------------------------------------------------------- */
/*  SUB-COMPONENTS                                                             */
/* -------------------------------------------------------------------------- */

function ProviderBadge({ provider, size = 44 }: { provider: Provider; size?: number }) {
  const config = PROVIDERS[provider];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 3.2,
        backgroundColor: config.accent,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: size / 2.4 }}>
        {config.initial}
      </Text>
    </View>
  );
}

function SimulationNotice({ compact = false }: { compact?: boolean }) {
  return (
    <View
      className={`flex-row items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl ${
        compact ? "p-2.5" : "p-3"
      }`}
    >
      <Info size={13} color="#d97706" style={{ marginTop: 1 }} />
      <Text className="flex-1 text-[10px] text-amber-800 font-medium leading-relaxed">
        Simulated linking for the ParKada thesis system. No GCash or Maya account is contacted and
        no payment credentials are stored.
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  MAIN                                                                       */
/* -------------------------------------------------------------------------- */

export default function LinkedEWallets() {
  const [wallets, setWallets] = useState<LinkedWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [step, setStep] = useState<Step>("provider");
  const [provider, setProvider] = useState<Provider | null>(null);
  const [numberInput, setNumberInput] = useState("");
  const [accountName, setAccountName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [verifyStage, setVerifyStage] = useState(0);

  const progress = useRef(new Animated.Value(0)).current;
  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  /* ------------------------------ data loading ---------------------------- */

  const loadWallets = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setWallets([]);
        return;
      }

      const { data, error } = await supabase
        .from(LINKED_WALLETS_TABLE)
        .select("*")
        .eq("profile_id", user.id)
        .order("linked_at", { ascending: false });

      if (error) {
        if (isMissingTableError(error)) {
          setMissingTable(true);
          setWallets([]);
          return;
        }
        throw error;
      }

      setMissingTable(false);
      setListError(null);
      setWallets((data ?? []) as LinkedWallet[]);
    } catch (error: any) {
      console.error("[LinkedEWallets]", error);
      setListError(error?.message ?? "Could not load your linked wallets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  /* -------------------------------- flow ---------------------------------- */

  const openFlow = () => {
    setProvider(null);
    setNumberInput("");
    setAccountName("");
    setFormError(null);
    setVerifyStage(0);
    progress.setValue(0);
    setStep("provider");
    setModalVisible(true);
  };

  const closeFlow = () => {
    setModalVisible(false);
    setSaving(false);
    progress.stopAnimation();
  };

  const goBack = () => {
    setFormError(null);
    if (step === "number") setStep("provider");
    else if (step === "confirm") setStep("number");
    else closeFlow();
  };

  const handleProviderSelected = (value: Provider) => {
    setProvider(value);
    setFormError(null);
    setStep("number");
  };

  const handleNumberSubmit = () => {
    const normalized = normalizePhMobile(numberInput);

    if (!normalized) {
      setFormError(
        "Enter a valid Philippine mobile number — 11 digits starting with 09, for example 0917 123 4567.",
      );
      return;
    }

    const duplicate = wallets.some(
      (wallet) =>
        wallet.provider === provider && digitsOnly(wallet.mobile_number) === normalized,
    );
    if (duplicate) {
      setFormError(
        `${PROVIDERS[provider!].name} ${maskPhMobile(normalized)} is already linked to your account.`,
      );
      return;
    }

    setFormError(null);
    setStep("confirm");
  };

  /** Simulated verification: a staged progress bar, then the database write. */
  const runSimulatedVerification = async () => {
    if (!provider) return;
    const normalized = normalizePhMobile(numberInput);
    if (!normalized) {
      setStep("number");
      setFormError("That number is no longer valid. Please re-enter it.");
      return;
    }

    setStep("verifying");
    setVerifyStage(0);
    setSaving(true);
    progress.setValue(0);

    const stageTimers = [
      setTimeout(() => setVerifyStage(1), 800),
      setTimeout(() => setVerifyStage(2), 1600),
    ];

    // Width animation cannot use the native driver.
    Animated.timing(progress, {
      toValue: 1,
      duration: 2400,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You need to be signed in to link a wallet.");

      // Let the animation play out so the step reads as a real verification.
      await new Promise((resolve) => setTimeout(resolve, 2400));

      const { data, error } = await supabase
        .from(LINKED_WALLETS_TABLE)
        .insert({
          profile_id: user.id,
          provider,
          mobile_number: normalized,
          account_name: accountName.trim() || null,
          is_default: wallets.length === 0,
        })
        .select("*")
        .single();

      if (error) {
        // 23505 = unique_violation (raced with another device)
        if (error.code === "23505") {
          throw new Error(
            `${PROVIDERS[provider].name} ${maskPhMobile(normalized)} is already linked.`,
          );
        }
        if (isMissingTableError(error)) {
          setMissingTable(true);
          throw new Error(
            "The linked_wallets table does not exist yet. Run parkada_updates.sql in Supabase.",
          );
        }
        throw error;
      }

      setWallets((prev) => [data as LinkedWallet, ...prev]);
      notifyWalletLinked({ provider, maskedNumber: maskPhMobile(normalized) });
      setStep("success");
    } catch (error: any) {
      console.error("[LinkedEWallets] link failed:", error);
      setFormError(error?.message ?? "Linking did not complete. Please try again.");
      setStep("confirm");
    } finally {
      stageTimers.forEach(clearTimeout);
      setSaving(false);
    }
  };

  const handleUnlink = (wallet: LinkedWallet) => {
    const label = `${PROVIDERS[wallet.provider].name} ${maskPhMobile(wallet.mobile_number)}`;
    Alert.alert("Unlink this wallet?", `${label} will be removed from your account.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unlink",
        style: "destructive",
        onPress: async () => {
          setRemovingId(wallet.id);
          const snapshot = wallets;
          setWallets((prev) => prev.filter((w) => w.id !== wallet.id));
          const { error } = await supabase
            .from(LINKED_WALLETS_TABLE)
            .delete()
            .eq("id", wallet.id);
          setRemovingId(null);
          if (error) {
            console.error("[LinkedEWallets] unlink failed:", error);
            setWallets(snapshot);
            Alert.alert("Could not unlink", error.message);
            return;
          }
          notifyWalletUnlinked({
            provider: wallet.provider,
            maskedNumber: maskPhMobile(wallet.mobile_number),
          });
        },
      },
    ]);
  };

  /* -------------------------------- render -------------------------------- */

  const normalizedPreview = normalizePhMobile(numberInput);

  return (
    <View>
      {/* Section header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Wallet size={14} color="#64748b" />
          <Text className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
            Linked e-Wallets
          </Text>
        </View>
        {wallets.length > 0 && (
          <Text className="text-[10px] font-bold text-slate-400">
            {wallets.length} linked
          </Text>
        )}
      </View>

      <View className="bg-white rounded-[20px] border border-slate-100 shadow-sm overflow-hidden">
        {missingTable ? (
          <View className="p-5 items-center">
            <AlertCircle size={26} color="#d97706" />
            <Text className="text-sm font-black text-slate-700 mt-2.5">
              Wallet linking isn't set up yet
            </Text>
            <Text className="text-[11px] text-slate-500 font-medium text-center mt-1.5 leading-relaxed">
              Run <Text className="font-mono text-slate-700">parkada_updates.sql</Text> in the
              Supabase SQL editor to create the{" "}
              <Text className="font-mono text-slate-700">{LINKED_WALLETS_TABLE}</Text> table.
            </Text>
          </View>
        ) : loading ? (
          <View className="p-8 items-center">
            <ActivityIndicator color="#0A1D37" />
          </View>
        ) : listError ? (
          <View className="p-5 items-center">
            <Text className="text-xs text-slate-500 font-medium text-center">{listError}</Text>
            <TouchableOpacity onPress={loadWallets} className="mt-3">
              <Text className="text-xs font-black text-blue-600">Try again</Text>
            </TouchableOpacity>
          </View>
        ) : wallets.length === 0 ? (
          <View className="p-6 items-center">
            <View className="w-12 h-12 rounded-full bg-slate-50 items-center justify-center mb-3">
              <Wallet size={22} color="#94a3b8" strokeWidth={1.8} />
            </View>
            <Text className="text-sm font-black text-slate-700">No wallets linked</Text>
            <Text className="text-[11px] text-slate-400 font-medium text-center mt-1 max-w-[230px]">
              Link GCash or Maya to pay for reservations without typing your number each time.
            </Text>
          </View>
        ) : (
          <View>
            {wallets.map((wallet, index) => {
              const config = PROVIDERS[wallet.provider] ?? PROVIDERS.gcash;
              return (
                <View
                  key={wallet.id}
                  className={`flex-row items-center gap-3 p-4 ${
                    index > 0 ? "border-t border-slate-100" : ""
                  }`}
                >
                  <ProviderBadge provider={wallet.provider} />

                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-black text-slate-800">{config.name}</Text>
                      {wallet.is_default && (
                        <View className={`px-1.5 py-0.5 rounded ${config.chipBg}`}>
                          <Text className={`text-[9px] font-black uppercase ${config.chipText}`}>
                            Default
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs text-slate-500 font-mono mt-0.5">
                      {maskPhMobile(wallet.mobile_number)}
                    </Text>
                    {wallet.account_name ? (
                      <Text className="text-[10px] text-slate-400 font-medium mt-0.5">
                        {wallet.account_name}
                      </Text>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    onPress={() => handleUnlink(wallet)}
                    disabled={removingId === wallet.id}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    className="w-9 h-9 rounded-full items-center justify-center bg-slate-50 border border-slate-100"
                  >
                    {removingId === wallet.id ? (
                      <ActivityIndicator size="small" color="#94a3b8" />
                    ) : (
                      <Trash2 size={15} color="#94a3b8" />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Add button */}
        {!missingTable && (
          <TouchableOpacity
            onPress={openFlow}
            activeOpacity={0.8}
            className="flex-row items-center justify-center gap-2 py-4 border-t border-slate-100 bg-slate-50/60"
          >
            <Plus size={16} color="#0A1D37" />
            <Text className="text-sm font-black text-[#0A1D37]">Add e-Wallet</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ------------------------------ MODAL ------------------------------ */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => (step === "verifying" ? undefined : closeFlow())}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          {/* Tap the darkened area to dismiss (not during verifying) */}
          <TouchableWithoutFeedback
            onPress={() => {
              Keyboard.dismiss();
              if (step !== "verifying") closeFlow();
            }}
          >
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)" }} />
          </TouchableWithoutFeedback>

          <View className="bg-white rounded-t-[28px] overflow-hidden" style={{ maxHeight: "88%" }}>
            {/* Modal header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-100">
              {step !== "verifying" && step !== "success" ? (
                <TouchableOpacity onPress={goBack} className="w-9 h-9 items-center justify-center -ml-2">
                  <ChevronLeft size={22} color="#0A1D37" />
                </TouchableOpacity>
              ) : (
                <View className="w-9" />
              )}

              <View className="flex-1 items-center">
                <Text className="font-black text-base text-[#0A1D37]">
                  {step === "provider" && "Add e-Wallet"}
                  {step === "number" && `Link ${provider ? PROVIDERS[provider].name : "wallet"}`}
                  {step === "confirm" && "Confirm details"}
                  {step === "verifying" && "Verifying"}
                  {step === "success" && "Wallet linked"}
                </Text>
                <Text className="text-[10px] font-bold text-slate-400 mt-0.5">
                  {step === "provider" && "Step 1 of 3"}
                  {step === "number" && "Step 2 of 3"}
                  {step === "confirm" && "Step 3 of 3"}
                  {step === "verifying" && "Please wait"}
                  {step === "success" && "All done"}
                </Text>
              </View>

              {step !== "verifying" ? (
                <TouchableOpacity
                  onPress={closeFlow}
                  className="w-9 h-9 items-center justify-center -mr-2"
                >
                  <X size={20} color="#94a3b8" />
                </TouchableOpacity>
              ) : (
                <View className="w-9" />
              )}
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {/* ---------------------------- STEP 1 --------------------------- */}
              {step === "provider" && (
                <View className="gap-3">
                  <Text className="text-[13px] text-slate-500 font-medium mb-1">
                    Choose the wallet you want to link to ParKada.
                  </Text>

                  {(Object.keys(PROVIDERS) as Provider[]).map((key) => {
                    const config = PROVIDERS[key];
                    const linkedCount = wallets.filter((w) => w.provider === key).length;
                    return (
                      <TouchableOpacity
                        key={key}
                        onPress={() => handleProviderSelected(key)}
                        activeOpacity={0.85}
                        className="flex-row items-center gap-3.5 p-4 rounded-2xl border-2 border-slate-200 bg-white"
                      >
                        <ProviderBadge provider={key} />
                        <View className="flex-1">
                          <Text className="text-[15px] font-black text-slate-800">
                            {config.name}
                          </Text>
                          <Text className="text-[11px] text-slate-500 font-medium mt-0.5">
                            {linkedCount > 0
                              ? `${linkedCount} number${linkedCount === 1 ? "" : "s"} already linked`
                              : config.blurb}
                          </Text>
                        </View>
                        <ChevronRight size={18} color="#cbd5e1" />
                      </TouchableOpacity>
                    );
                  })}

                  <View className="mt-2">
                    <SimulationNotice />
                  </View>
                </View>
              )}

              {/* ---------------------------- STEP 2 --------------------------- */}
              {step === "number" && provider && (
                <View>
                  <View className="items-center mb-5">
                    <ProviderBadge provider={provider} size={56} />
                    <Text className="text-[13px] text-slate-500 font-medium text-center mt-3 max-w-[260px]">
                      Enter the mobile number registered to your {PROVIDERS[provider].name} account.
                    </Text>
                  </View>

                  <Text className="text-[11px] font-black uppercase text-slate-500 mb-2">
                    Mobile number
                  </Text>
                  <View
                    className={`flex-row items-center rounded-2xl border-2 px-4 ${
                      formError ? "border-rose-300 bg-rose-50/40" : "border-slate-200 bg-white"
                    }`}
                  >
                    <Text className="text-slate-400 font-bold text-base mr-2">🇵🇭 +63</Text>
                    <TextInput
                      value={formatPhMobile(numberInput)}
                      onChangeText={(text) => {
                        setNumberInput(digitsOnly(text).slice(0, 11));
                        if (formError) setFormError(null);
                      }}
                      placeholder="0917 123 4567"
                      placeholderTextColor="#cbd5e1"
                      keyboardType="number-pad"
                      returnKeyType="done"
                      maxLength={13}
                      onSubmitEditing={handleNumberSubmit}
                      className="flex-1 py-4 text-base font-bold text-slate-800"
                      style={Platform.OS === "android" ? { paddingVertical: 12 } : undefined}
                    />
                    {normalizedPreview && <Check size={18} color="#059669" />}
                  </View>

                  <Text className="text-[11px] font-black uppercase text-slate-500 mt-4 mb-2">
                    Account name <Text className="text-slate-300">(optional)</Text>
                  </Text>
                  <TextInput
                    value={accountName}
                    onChangeText={setAccountName}
                    placeholder="Name shown on your wallet"
                    placeholderTextColor="#cbd5e1"
                    className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-base font-bold text-slate-800"
                    style={Platform.OS === "android" ? { paddingVertical: 12 } : undefined}
                  />

                  {formError && (
                    <View className="flex-row items-start gap-2 mt-3">
                      <AlertCircle size={14} color="#e11d48" style={{ marginTop: 1 }} />
                      <Text className="flex-1 text-[11px] text-rose-600 font-medium leading-relaxed">
                        {formError}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={handleNumberSubmit}
                    disabled={!normalizedPreview}
                    className={`h-14 rounded-2xl items-center justify-center mt-6 ${
                      normalizedPreview ? "bg-[#0A1D37]" : "bg-slate-200"
                    }`}
                  >
                    <Text
                      className={`text-[15px] font-black ${
                        normalizedPreview ? "text-white" : "text-slate-400"
                      }`}
                    >
                      Continue
                    </Text>
                  </TouchableOpacity>

                  <View className="mt-4">
                    <SimulationNotice compact />
                  </View>
                </View>
              )}

              {/* ---------------------------- STEP 3 --------------------------- */}
              {step === "confirm" && provider && (
                <View>
                  <Text className="text-[13px] text-slate-500 font-medium mb-4">
                    Check that this is right before linking.
                  </Text>

                  <View className="rounded-2xl border border-slate-200 overflow-hidden">
                    <View className="flex-row items-center gap-3.5 p-4 bg-slate-50/60">
                      <ProviderBadge provider={provider} />
                      <View className="flex-1">
                        <Text className="text-[15px] font-black text-slate-800">
                          {PROVIDERS[provider].name}
                        </Text>
                        <Text className="text-[11px] text-slate-500 font-medium">
                          e-Wallet provider
                        </Text>
                      </View>
                    </View>

                    <View className="p-4 border-t border-slate-200">
                      <Text className="text-[10px] font-black uppercase text-slate-400 mb-1">
                        Mobile number
                      </Text>
                      <Text className="text-lg font-black text-slate-800 font-mono">
                        {formatPhMobile(numberInput)}
                      </Text>
                    </View>

                    {accountName.trim() ? (
                      <View className="p-4 border-t border-slate-200">
                        <Text className="text-[10px] font-black uppercase text-slate-400 mb-1">
                          Account name
                        </Text>
                        <Text className="text-sm font-bold text-slate-700">
                          {accountName.trim()}
                        </Text>
                      </View>
                    ) : null}

                    <View className="p-4 border-t border-slate-200">
                      <Text className="text-[10px] font-black uppercase text-slate-400 mb-1">
                        Shown in the app as
                      </Text>
                      <Text className="text-sm font-bold text-slate-700 font-mono">
                        {maskPhMobile(numberInput)}
                      </Text>
                    </View>
                  </View>

                  {formError && (
                    <View className="flex-row items-start gap-2 mt-3">
                      <AlertCircle size={14} color="#e11d48" style={{ marginTop: 1 }} />
                      <Text className="flex-1 text-[11px] text-rose-600 font-medium leading-relaxed">
                        {formError}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={runSimulatedVerification}
                    disabled={saving}
                    className="h-14 rounded-2xl items-center justify-center mt-6 bg-[#0A1D37]"
                  >
                    <Text className="text-[15px] font-black text-white">
                      Link {PROVIDERS[provider].name}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setStep("number")} className="mt-3 items-center">
                    <Text className="text-xs font-bold text-slate-500">Edit number</Text>
                  </TouchableOpacity>

                  <View className="mt-4">
                    <SimulationNotice />
                  </View>
                </View>
              )}

              {/* ---------------------------- VERIFYING ------------------------ */}
              {step === "verifying" && provider && (
                <View className="items-center py-6">
                  <ProviderBadge provider={provider} size={64} />

                  <Text className="text-lg font-black text-slate-800 mt-5">
                    Verifying your number
                  </Text>
                  <Text className="text-[12px] text-slate-500 font-medium text-center mt-1.5 max-w-[250px]">
                    Simulated check — this does not contact {PROVIDERS[provider].name}.
                  </Text>

                  {/* Progress bar */}
                  <View className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-7">
                    <Animated.View
                      style={{
                        height: "100%",
                        width: progressWidth,
                        backgroundColor: PROVIDERS[provider].accent,
                        borderRadius: 999,
                      }}
                    />
                  </View>

                  {/* Stages */}
                  <View className="w-full mt-6 gap-3">
                    {[
                      "Checking the number format",
                      "Matching it to your ParKada account",
                      "Saving the link",
                    ].map((label, index) => {
                      const done = verifyStage > index;
                      const active = verifyStage === index;
                      return (
                        <View key={label} className="flex-row items-center gap-3">
                          <View
                            className={`w-6 h-6 rounded-full items-center justify-center ${
                              done ? "bg-emerald-100" : active ? "bg-slate-100" : "bg-slate-50"
                            }`}
                          >
                            {done ? (
                              <Check size={13} color="#059669" strokeWidth={3} />
                            ) : active ? (
                              <ActivityIndicator size="small" color="#64748b" />
                            ) : (
                              <View className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            )}
                          </View>
                          <Text
                            className={`text-[12px] font-medium ${
                              done
                                ? "text-slate-700"
                                : active
                                  ? "text-slate-600"
                                  : "text-slate-400"
                            }`}
                          >
                            {label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* ---------------------------- SUCCESS -------------------------- */}
              {step === "success" && provider && (
                <View className="items-center py-4">
                  <View className="w-20 h-20 rounded-full bg-emerald-50 items-center justify-center">
                    <CheckCircle2 size={40} color="#059669" strokeWidth={2} />
                  </View>

                  <Text className="text-xl font-black text-slate-800 mt-5">
                    {PROVIDERS[provider].name} linked
                  </Text>
                  <Text className="text-[13px] text-slate-500 font-medium text-center mt-2 max-w-[260px]">
                    {maskPhMobile(numberInput)} is now saved to your ParKada account and will appear
                    at checkout.
                  </Text>

                  <View className="flex-row items-center gap-2 mt-5 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                    <ShieldCheck size={14} color="#059669" />
                    <Text className="text-[11px] font-bold text-emerald-800">
                      No payment credentials were stored
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={closeFlow}
                    className="h-14 w-full rounded-2xl items-center justify-center mt-7 bg-[#0A1D37]"
                  >
                    <Text className="text-[15px] font-black text-white">
                      Back to Linked e-Wallets
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setProvider(null);
                      setNumberInput("");
                      setAccountName("");
                      setFormError(null);
                      setVerifyStage(0);
                      progress.setValue(0);
                      setStep("provider");
                    }}
                    className="mt-3"
                  >
                    <Text className="text-xs font-bold text-slate-500">Link another wallet</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}