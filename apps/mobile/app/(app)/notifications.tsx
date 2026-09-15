import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BellOff,
  CheckCircle2,
  Clock,
  AlertCircle,
  Info,
  CheckCheck,
  Trash2,
  RefreshCcw,
  Wallet,
  Car,
  ShieldCheck,
  MapPin,
} from "lucide-react-native";
import { supabase } from "../../lib/supabase";

/**
 * NOTE ON THE ROOT CAUSE
 * ----------------------------------------------------------------------------
 * This screen was never broken — it had nothing to display. Nothing in the app
 * inserted rows into `notifications`: the admin panel only invoked the
 * `send-push` edge function (a push is not persisted), and the reservation /
 * payment / profile flows wrote no rows at all.
 *
 * Writing now happens through lib/notify.ts. This screen adds:
 *   - a realtime subscription so new alerts appear without a manual refresh
 *   - tolerance for the read flag being spelled `is_read` OR `read`
 *   - delete / clear-all, unread filter, date grouping, and error states
 * ----------------------------------------------------------------------------
 */

type Notification = {
  id: string;
  user_id: string;
  title: string | null;
  message: string | null;
  is_read?: boolean | null;
  read?: boolean | null;
  created_at: string;
  [key: string]: any;
};

/** The read flag is spelled differently in different parts of the project. */
const isUnread = (n: Notification) => !(n?.is_read ?? n?.read ?? false);

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
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

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/** Bucket a notification into Today / Yesterday / Earlier. */
const getDateGroup = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const time = date.getTime();
  if (time >= startOfToday) return "Today";
  if (time >= startOfYesterday) return "Yesterday";
  return "Earlier";
};

/** Infer the icon treatment from the notification title. */
const getIconProps = (title: string | null) => {
  const lowerTitle = (title || "").toLowerCase();

  if (lowerTitle.includes("payment") || lowerTitle.includes("paid") || lowerTitle.includes("refund")) {
    return { Icon: Wallet, bg: "bg-emerald-100", iconColor: "#059669" };
  }
  if (lowerTitle.includes("gcash") || lowerTitle.includes("maya") || lowerTitle.includes("wallet")) {
    return { Icon: Wallet, bg: "bg-sky-100", iconColor: "#0284c7" };
  }
  if (lowerTitle.includes("verif") || lowerTitle.includes("discount") || lowerTitle.includes("approve")) {
    return { Icon: ShieldCheck, bg: "bg-indigo-100", iconColor: "#4f46e5" };
  }
  if (lowerTitle.includes("vehicle") || lowerTitle.includes("plate")) {
    return { Icon: Car, bg: "bg-slate-200", iconColor: "#475569" };
  }
  if (lowerTitle.includes("expir") || lowerTitle.includes("ending") || lowerTitle.includes("time")) {
    return { Icon: Clock, bg: "bg-amber-100", iconColor: "#d97706" };
  }
  if (lowerTitle.includes("confirm") || lowerTitle.includes("success") || lowerTitle.includes("reserv")) {
    return { Icon: CheckCircle2, bg: "bg-emerald-100", iconColor: "#059669" };
  }
  if (lowerTitle.includes("fail") || lowerTitle.includes("cancel") || lowerTitle.includes("penalt") || lowerTitle.includes("not approved")) {
    return { Icon: AlertCircle, bg: "bg-rose-100", iconColor: "#e11d48" };
  }
  if (lowerTitle.includes("park") || lowerTitle.includes("slot") || lowerTitle.includes("lot")) {
    return { Icon: MapPin, bg: "bg-blue-100", iconColor: "#2563eb" };
  }
  return { Icon: Info, bg: "bg-blue-100", iconColor: "#2563eb" };
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const userIdRef = useRef<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setNotifications([]);
        setErrorMessage("You need to sign in to see your alerts.");
        return;
      }
      userIdRef.current = user.id;

      // select("*") keeps this working whichever way the read flag is spelled.
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setNotifications(data || []);
      setErrorMessage(null);
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
      setErrorMessage(error?.message || "Could not load your alerts.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime — new alerts land without pulling to refresh.
  useEffect(() => {
    let channel: any;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            if (payload.eventType === "INSERT") {
              setNotifications((prev) =>
                prev.some((n) => n.id === payload.new.id) ? prev : [payload.new, ...prev],
              );
            } else if (payload.eventType === "UPDATE") {
              setNotifications((prev) =>
                prev.map((n) => (n.id === payload.new.id ? { ...n, ...payload.new } : n)),
              );
            } else if (payload.eventType === "DELETE") {
              setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id));
            }
          },
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  /** Update the read flag, tolerating either column spelling. */
  const writeReadFlag = async (ids: string[], value: boolean) => {
    if (ids.length === 0) return;
    let { error } = await supabase
      .from("notifications")
      .update({ is_read: value })
      .in("id", ids);
    if (error) {
      const retry = await supabase.from("notifications").update({ read: value }).in("id", ids);
      error = retry.error;
    }
    if (error) throw error;
  };

  const markAsRead = async (item: Notification) => {
    if (!isUnread(item)) return;

    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, is_read: true, read: true } : n)),
    );

    try {
      await writeReadFlag([item.id], true);
    } catch (error) {
      console.error("Failed to mark notification as read", error);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: false, read: false } : n)),
      );
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(isUnread).map((n) => n.id);
    if (unreadIds.length === 0) return;

    const snapshot = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read: true })));

    try {
      await writeReadFlag(unreadIds, true);
    } catch (error) {
      console.error("Failed to mark all as read", error);
      setNotifications(snapshot);
    }
  };

  const deleteNotification = async (item: Notification) => {
    const snapshot = notifications;
    setNotifications((prev) => prev.filter((n) => n.id !== item.id));
    const { error } = await supabase.from("notifications").delete().eq("id", item.id);
    if (error) {
      console.error("Failed to delete notification", error);
      setNotifications(snapshot);
    }
  };

  const clearAll = () => {
    if (notifications.length === 0) return;
    Alert.alert(
      "Clear all alerts?",
      "This removes every alert from your list. It cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear all",
          style: "destructive",
          onPress: async () => {
            const snapshot = notifications;
            setNotifications([]);
            const userId = userIdRef.current;
            if (!userId) return;
            const { error } = await supabase
              .from("notifications")
              .delete()
              .eq("user_id", userId);
            if (error) {
              console.error("Failed to clear notifications", error);
              setNotifications(snapshot);
            }
          },
        },
      ],
    );
  };

  const unreadCount = useMemo(() => notifications.filter(isUnread).length, [notifications]);

  const visible = useMemo(
    () => (showUnreadOnly ? notifications.filter(isUnread) : notifications),
    [notifications, showUnreadOnly],
  );

  /** Group the visible alerts into Today / Yesterday / Earlier sections. */
  const sections = useMemo(() => {
    const order = ["Today", "Yesterday", "Earlier"];
    const grouped: Record<string, Notification[]> = {};
    visible.forEach((item) => {
      const key = getDateGroup(item.created_at);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return order
      .filter((key) => grouped[key]?.length)
      .map((key) => ({ title: key, data: grouped[key] }));
  }, [visible]);

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: "#f8fafc",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#0A1D37" />
        <Text className="text-xs text-slate-400 font-bold mt-3">Loading your alerts…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* Header */}
      <View className="px-5 py-4 bg-white border-b border-slate-100 z-10">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Image
              source={require("../../assets/ParKadav2.png")}
              className="w-10 h-10 rounded-md"
              resizeMode="contain"
            />
            <Text className="font-black text-xl">
              <Text className="text-[#0A1D37]">Par</Text>
              <Text className="text-amber-400">Kada</Text>
            </Text>
          </View>
        </View>

        {/* Filter chips & Actions */}
        {notifications.length > 0 && (
          <View className="flex-row items-center justify-between mt-3">
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setShowUnreadOnly(false)}
                className={`px-3.5 py-1.5 rounded-full border ${
                  !showUnreadOnly ? "bg-[#0A1D37] border-[#0A1D37]" : "bg-white border-slate-200"
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    !showUnreadOnly ? "text-white" : "text-slate-500"
                  }`}
                >
                  All ({notifications.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowUnreadOnly(true)}
                className={`px-3.5 py-1.5 rounded-full border ${
                  showUnreadOnly ? "bg-[#0A1D37] border-[#0A1D37]" : "bg-white border-slate-200"
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    showUnreadOnly ? "text-white" : "text-slate-500"
                  }`}
                >
                  Unread ({unreadCount})
                </Text>
              </TouchableOpacity>
            </View>
            
            <View className="flex-row items-center gap-2">
              {unreadCount > 0 && (
                <TouchableOpacity
                  onPress={markAllAsRead}
                  className="flex-row items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 active:bg-slate-100"
                >
                  <CheckCheck size={14} color="#64748b" />
                  <Text className="text-[11px] font-bold text-slate-500">Read all</Text>
                </TouchableOpacity>
              )}
              {notifications.length > 0 && (
                <TouchableOpacity
                  onPress={clearAll}
                  className="w-9 h-9 rounded-full items-center justify-center bg-slate-50 border border-slate-200 active:bg-slate-100"
                >
                  <Trash2 size={15} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Error state */}
      {errorMessage ? (
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A1D37" />
          }
        >
          <View className="w-20 h-20 bg-rose-50 rounded-full items-center justify-center mb-5">
            <AlertCircle size={32} color="#e11d48" strokeWidth={1.8} />
          </View>
          <Text className="text-lg font-black text-slate-800 mb-1.5">
            Couldn't load your alerts
          </Text>
          <Text className="text-sm text-slate-500 text-center font-medium max-w-[280px]">
            {errorMessage}
          </Text>
          <TouchableOpacity
            onPress={onRefresh}
            className="mt-5 flex-row items-center gap-2 bg-[#0A1D37] px-5 py-3 rounded-2xl"
          >
            <RefreshCcw size={15} color="#ffffff" />
            <Text className="text-white font-bold text-sm">Try again</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : visible.length === 0 ? (
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A1D37" />
          }
        >
          <View className="w-24 h-24 bg-slate-100 rounded-full items-center justify-center mb-6">
            <BellOff size={36} color="#94a3b8" strokeWidth={1.5} />
          </View>
          <Text className="text-xl font-black text-slate-800 mb-2">
            {showUnreadOnly ? "Nothing unread" : "You're all caught up"}
          </Text>
          <Text className="text-sm text-slate-500 text-center font-medium leading-relaxed max-w-[260px]">
            {showUnreadOnly
              ? "Every alert has been read. Switch back to All to see your history."
              : "Reservations, payments, expiring sessions and account updates will show up here."}
          </Text>
          {showUnreadOnly && (
            <TouchableOpacity onPress={() => setShowUnreadOnly(false)} className="mt-5">
              <Text className="text-sm font-black text-blue-600">Show all alerts</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A1D37" />
          }
        >
          <View className="p-4 pb-24">
            {sections.map((section) => (
              <View key={section.title} className="mb-2">
                <View className="flex-row items-center mb-2.5 ml-1 gap-2">
                  <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {section.title}
                  </Text>
                  {section.title === "Today" && unreadCount > 0 && (
                    <View className="bg-rose-500 px-2 py-0.5 rounded-full items-center justify-center">
                      <Text className="text-[10px] font-black text-white">{unreadCount} new</Text>
                    </View>
                  )}
                </View>

                <View className="flex-col gap-3 mb-4">
                  {section.data.map((item) => {
                    const { Icon, bg, iconColor } = getIconProps(item.title);
                    const unread = isUnread(item);

                    return (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.75}
                        onPress={() => markAsRead(item)}
                        onLongPress={() =>
                          Alert.alert("Delete this alert?", item.title || "Notification", [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () => deleteNotification(item),
                            },
                          ])
                        }
                        className={`p-4 rounded-2xl flex-row gap-3.5 border ${
                          unread
                            ? "bg-white border-blue-100 shadow-sm"
                            : "bg-slate-50 border-slate-100"
                        }`}
                      >
                        {/* Icon */}
                        <View className="items-center justify-start pt-0.5 relative">
                          <View
                            className={`w-12 h-12 rounded-2xl items-center justify-center ${
                              unread ? bg : "bg-slate-200"
                            }`}
                          >
                            <Icon
                              size={21}
                              color={unread ? iconColor : "#94a3b8"}
                              strokeWidth={2}
                            />
                          </View>
                          {unread && (
                            <View className="absolute top-0 right-0 w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full" />
                          )}
                        </View>

                        {/* Content */}
                        <View className="flex-1 justify-center">
                          <View className="flex-row justify-between items-start mb-1">
                            <Text
                              className={`flex-1 text-sm ${
                                unread ? "font-black text-slate-900" : "font-bold text-slate-700"
                              }`}
                              numberOfLines={1}
                            >
                              {item.title || "Notification"}
                            </Text>
                            <Text
                              className={`text-[10px] ml-2 mt-0.5 ${
                                unread
                                  ? "font-bold text-blue-500"
                                  : "font-semibold text-slate-400"
                              }`}
                            >
                              {formatTimeAgo(item.created_at)}
                            </Text>
                          </View>

                          <Text
                            className={`text-xs leading-relaxed ${
                              unread ? "text-slate-600 font-medium" : "text-slate-500"
                            }`}
                          >
                            {item.message || "You have a new update."}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            <Text className="text-[10px] text-slate-300 text-center font-medium mt-2">
              Press and hold an alert to delete it
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
