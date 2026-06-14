import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Car, Plus, Trash2, Info, ChevronLeft, ChevronDown, X } from "lucide-react-native";
import { supabase } from "../../lib/supabase";

const ALLOWED_CAR_BRANDS = [
  "Audi", "BMW", "BYD", "Changan", "Chery", "Chevrolet", "Dodge", "Dongfeng", "Ford", "Foton", "GAC Motor", "Geely", "GWM", 
  "Honda", "Hyundai", "Isuzu", "Jaecoo", "Jaguar", "Jeep", "Jetour", "Kia", "Land Rover", "Lexus", "Mahindra", "Mazda", "Mercedes-Benz", 
  "MG", "Mini", "Mitsubishi", "Nissan", "Omoda", "Peugeot", "Porsche", "Subaru", "Suzuki", "Tata", "Toyota", "Volkswagen", "Volvo", "Wuling"
];

export default function VehiclesPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);
  const [showBrandPicker, setShowBrandPicker] = useState(false);
  const [form, setForm] = useState({ plate: "", brand: "", model: "", color: "" });

  const MAX_VEHICLES = 3; 
  const isMaxReached = vehicles.length >= MAX_VEHICLES;

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setLoading(false);
        return; 
      }

      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("profile_id", user.id)
        .eq("is_active", true) 
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  };

  const validateLTOPlate = (plate: string): boolean => {
    const plateRegex = /^[A-Z]{3}[\s-]?[0-9]{3,4}$/i;
    return plateRegex.test(plate.trim());
  };

  const addVehicle = async () => {
    if (!form.plate || !form.brand || !form.model || !form.color) {
      Alert.alert("Required", "Please fill all fields");
      return;
    }

    if (!validateLTOPlate(form.plate)) {
      Alert.alert("Invalid Plate Number", "Must be LTO standard (e.g., ABC 123 or ABC 1234).");
      return;
    }

    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAdding(false);
        return;
      }

      const sanitizedPlate = form.plate.toUpperCase().replace(/[^A-Z0-9]/g, "");

      const { data: existingVehicle, error: checkError } = await supabase
        .from("vehicles")
        .select("id")
        .eq("plate", sanitizedPlate)
        .maybeSingle(); 

      if (checkError) throw checkError;
      if (existingVehicle) {
        Alert.alert("Duplicate", `Plate number ${sanitizedPlate} is already registered!`);
        setAdding(false);
        return; 
      }

      const { count, error: countError } = await supabase
        .from("vehicles")
        .select("*", { count: 'exact', head: true })
        .eq("profile_id", user.id)
        .eq("is_active", true);

      if (countError) throw countError;
      if ((count || 0) >= MAX_VEHICLES) {
        Alert.alert("Limit Reached", `You can only register up to ${MAX_VEHICLES} vehicles.`);
        setOpen(false); 
        setForm({ plate: "", brand: "", model: "", color: "" }); 
        setAdding(false); 
        return; 
      }

      const fullModel = `${form.brand} ${form.model.trim()}`;

      const { error: insertError } = await supabase
        .from("vehicles")
        .insert([{
          profile_id: user.id,
          plate: sanitizedPlate,
          model: fullModel,
          color: form.color.trim(),
          is_active: true
        }]);

      if (insertError?.code === '23505') { 
        Alert.alert("Duplicate", `Plate number ${sanitizedPlate} is already in the system!`);
        setAdding(false);
        return;
      } else if (insertError) {
        throw insertError;
      }

      await supabase.from("notifications").insert([{
        user_id: user.id,
        title: "Vehicle Registered 🚗",
        message: `Your ${fullModel} (${sanitizedPlate}) has been added to your garage.`,
        type: "system",
        read: false
      }]);

      Alert.alert("Success", "Vehicle added!");
      setForm({ plate: "", brand: "", model: "", color: "" });
      setOpen(false);
      fetchVehicles(); 
    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong.");
    } finally {
      setAdding(false);
    }
  };

  const removeVehicle = (id: string, plate: string) => {
    Alert.alert(
      "Remove Vehicle",
      `Are you sure you want to remove ${plate}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("vehicles")
                .update({ is_active: false })
                .eq("id", id);
              if (error) throw error;
        
              setVehicles((v) => v.filter((x) => x.id !== id));
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center">
        <ActivityIndicator size="large" color="#0A1D37" />
        <Text className="mt-4 font-bold text-slate-500">Loading vehicles...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-200">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-full">
          <ChevronLeft size={24} color="#0A1D37" />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-black text-lg text-[#0A1D37] mr-6">My Vehicles</Text>
      </View>

      <View className="flex-1 p-4">
        {vehicles.length === 0 ? (
          <View className="items-center py-20 bg-slate-100 rounded-3xl border-2 border-dashed border-slate-300">
            <Car size={64} color="#cbd5e1" className="mb-4" />
            <Text className="text-base font-bold text-slate-400">No vehicles yet.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
            <View className="space-y-3 pb-4">
              {vehicles.map((v) => (
                <View key={v.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex-row items-center gap-4 mb-3">
                  <View className="w-14 h-14 rounded-xl bg-[#0A1D37] items-center justify-center">
                    <Car size={24} color="white" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-lg font-black text-slate-800 uppercase tracking-tight">{v.plate}</Text>
                    <Text className="text-[11px] font-bold text-slate-400 uppercase mt-0.5">{v.model} • {v.color}</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => removeVehicle(v.id, v.plate)} 
                    className="p-3 bg-rose-50 rounded-full"
                  >
                    <Trash2 size={20} color="#f43f5e" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Info Tip */}
        <View className="flex-row items-start gap-3 p-4 bg-blue-50 rounded-2xl opacity-80 mt-auto mb-4">
          <Info size={20} color="#3b82f6" className="mt-0.5" />
          <Text className="flex-1 text-[11px] font-bold text-blue-700 leading-relaxed uppercase">
            Registered vehicles will appear as options during your slot reservation process.
          </Text>
        </View>

        <TouchableOpacity 
          onPress={() => setOpen(true)}
          disabled={isMaxReached}
          className={`w-full h-16 rounded-2xl flex-row items-center justify-center border-2 border-dashed shadow-sm ${
            isMaxReached 
              ? "border-slate-300 bg-slate-200 opacity-60" 
              : "border-slate-300 bg-white"
          }`}
        >
          <Plus size={20} color={isMaxReached ? "#94a3b8" : "#64748B"} className="mr-2" />
          <Text className={`font-black text-base ${isMaxReached ? "text-slate-400" : "text-slate-600"}`}>
            {isMaxReached ? `Max Limit Reached (${MAX_VEHICLES}/${MAX_VEHICLES})` : "Register New Vehicle"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Add Vehicle Modal */}
      <Modal visible={open} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl p-6 h-[85%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-black uppercase tracking-tight text-[#0A1D37]">Add Vehicle</Text>
              <TouchableOpacity onPress={() => setOpen(false)} className="p-2 bg-slate-100 rounded-full">
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              <View className="space-y-5 pb-10">
                
                <View className="mb-4">
                  <Text className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1.5">Plate Number</Text>
                  <TextInput 
                    value={form.plate} 
                    onChangeText={(text) => setForm((f) => ({ ...f, plate: text.toUpperCase() }))} 
                    placeholder="ABC 1234" 
                    placeholderTextColor="#94a3b8"
                    className="h-14 rounded-xl bg-slate-50 px-4 font-black uppercase text-lg text-slate-800" 
                  />
                  <Text className="text-[10px] text-slate-400 ml-1 mt-1 font-medium">LTO format: 3 letters + 3-4 numbers (e.g., ABC 123)</Text>
                </View>

                <View className="mb-4">
                  <Text className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1.5">Car Brand</Text>
                  <TouchableOpacity 
                    onPress={() => setShowBrandPicker(true)}
                    className="h-14 rounded-xl bg-slate-50 px-4 flex-row items-center justify-between"
                  >
                    <Text className={`font-bold text-base ${form.brand ? 'text-slate-800' : 'text-slate-400'}`}>
                      {form.brand || "Select brand"}
                    </Text>
                    <ChevronDown size={20} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                <View className="mb-4">
                  <Text className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1.5">Model</Text>
                  <TextInput 
                    value={form.model} 
                    onChangeText={(text) => setForm((f) => ({ ...f, model: text }))} 
                    placeholder="e.g., Vios" 
                    placeholderTextColor="#94a3b8"
                    editable={!!form.brand}
                    className={`h-14 rounded-xl bg-slate-50 px-4 font-bold text-base text-slate-800 ${!form.brand ? 'opacity-50' : ''}`} 
                  />
                </View>

                <View className="mb-6">
                  <Text className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1.5">Color</Text>
                  <TextInput 
                    value={form.color} 
                    onChangeText={(text) => setForm((f) => ({ ...f, color: text }))} 
                    placeholder="White" 
                    placeholderTextColor="#94a3b8"
                    className="h-14 rounded-xl bg-slate-50 px-4 font-bold text-base text-slate-800" 
                  />
                </View>

                <TouchableOpacity 
                  onPress={addVehicle} 
                  disabled={adding || !form.brand || !form.model || !form.color || !validateLTOPlate(form.plate)}
                  className={`w-full h-16 rounded-2xl flex-row items-center justify-center shadow-lg ${
                    adding || !form.brand || !form.model || !form.color || !validateLTOPlate(form.plate)
                      ? "bg-blue-300" 
                      : "bg-[#0A1D37]"
                  }`}
                >
                  {adding ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="font-black text-white text-base tracking-widest uppercase">Register Vehicle</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Brand Picker Modal */}
      <Modal visible={showBrandPicker} animationType="fade" transparent>
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white w-full rounded-3xl overflow-hidden max-h-[70%]">
            <View className="p-4 border-b border-slate-100 flex-row justify-between items-center bg-slate-50">
              <Text className="font-black text-lg text-slate-800">Select Brand</Text>
              <TouchableOpacity onPress={() => setShowBrandPicker(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={true}>
              {ALLOWED_CAR_BRANDS.map(brand => (
                <TouchableOpacity 
                  key={brand}
                  onPress={() => {
                    setForm(f => ({ ...f, brand }));
                    setShowBrandPicker(false);
                  }}
                  className="p-4 border-b border-slate-50 active:bg-blue-50"
                >
                  <Text className={`text-base font-bold ${form.brand === brand ? 'text-blue-600' : 'text-slate-700'}`}>{brand}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
