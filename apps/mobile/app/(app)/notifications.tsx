import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BellOff, CheckCircle2, Clock, AlertCircle, Info, CheckCheck } from "lucide-react-native";
import { supabase } from "../../lib/supabase";

type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

// Helper to format timestamps gracefully
const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return "Yesterday";
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  // Format as date string for older notifications
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Infer UI properties from title
const getIconProps = (title: string | null) => {
  const lowerTitle = (title || "").toLowerCase();
  if (lowerTitle.includes("expir") || lowerTitle.includes("end") || lowerTitle.includes("time")) {
    return { Icon: Clock, bg: "bg-amber-100", iconColor: "#d97706" }; // Amber
  }
  if (lowerTitle.includes("confirm") || lowerTitle.includes("success") || lowerTitle.includes("paid")) {
    return { Icon: CheckCircle2, bg: "bg-emerald-100", iconColor: "#059669" }; // Emerald
  }
  if (lowerTitle.includes("fail") || lowerTitle.includes("cancel") || lowerTitle.includes("penalty")) {
    return { Icon: AlertCircle, bg: "bg-rose-100", iconColor: "#e11d48" }; // Rose
  }
  return { Icon: Info, bg: "bg-blue-100", iconColor: "#2563eb" }; // Default Blue
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string, is_read: boolean) => {
    if (is_read) return; // Already read
    
    // Optimistic UI update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
    } catch (error) {
      console.error("Failed to mark notification as read", error);
      // Revert if failed
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: false } : n));
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
    } catch (error) {
      console.error("Failed to mark all as read", error);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0A1D37" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* Header */}
      <View className="px-5 py-4 bg-white border-b border-slate-200 flex-row justify-between items-center z-10">
        <View className="flex-row items-center gap-2">
          <Text className="text-2xl font-black text-[#0A1D37] tracking-tight">Alerts</Text>
          {unreadCount > 0 && (
            <View className="bg-rose-500 px-2 py-0.5 rounded-full items-center justify-center">
              <Text className="text-[10px] font-black text-white">{unreadCount}</Text>
            </View>
          )}
        </View>
        
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead} className="flex-row items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 active:bg-slate-100">
            <CheckCheck size={14} color="#64748b" />
            <Text className="text-[11px] font-bold text-slate-500">Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Content */}
      {notifications.length === 0 ? (
        // Empty State
        <ScrollView 
          contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A1D37" />}
        >
          <View className="w-24 h-24 bg-slate-100 rounded-full items-center justify-center mb-6">
            <BellOff size={36} color="#94a3b8" strokeWidth={1.5} />
          </View>
          <Text className="text-xl font-black text-slate-800 mb-2">You're all caught up!</Text>
          <Text className="text-sm text-slate-500 text-center font-medium leading-relaxed max-w-[250px]">
            We'll notify you here about your upcoming reservations, expiring sessions, and important updates.
          </Text>
        </ScrollView>
      ) : (
        // Notifications List
        <ScrollView 
          className="flex-1"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A1D37" />}
        >
          <View className="p-4 space-y-3 pb-24">
            {notifications.map((item) => {
              const { Icon, bg, iconColor } = getIconProps(item.title);
              const isUnread = !item.is_read;
              
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.7}
                  onPress={() => markAsRead(item.id, item.is_read)}
                  className={`p-4 rounded-2xl flex-row gap-4 border ${isUnread ? 'bg-white border-blue-100 shadow-sm' : 'bg-slate-50 border-slate-100'}`}
                >
                  {/* Left Icon */}
                  <View className="items-center justify-start pt-1 relative">
                    <View className={`w-12 h-12 rounded-2xl items-center justify-center ${isUnread ? bg : 'bg-slate-200'}`}>
                      <Icon size={22} color={isUnread ? iconColor : '#94a3b8'} strokeWidth={2} />
                    </View>
                    {/* Unread indicator dot */}
                    {isUnread && (
                      <View className="absolute top-0 right-0 w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full" />
                    )}
                  </View>
                  
                  {/* Content */}
                  <View className="flex-1 justify-center">
                    <View className="flex-row justify-between items-start mb-1">
                      <Text className={`flex-1 text-sm ${isUnread ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`} numberOfLines={1}>
                        {item.title || "Notification"}
                      </Text>
                      <Text className={`text-[10px] ml-2 mt-0.5 ${isUnread ? 'font-bold text-blue-500' : 'font-semibold text-slate-400'}`}>
                        {formatTimeAgo(item.created_at)}
                      </Text>
                    </View>
                    
                    <Text className={`text-xs leading-relaxed ${isUnread ? 'text-slate-600 font-medium' : 'text-slate-500'}`}>
                      {item.message || "You have a new update."}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
