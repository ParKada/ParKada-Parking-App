import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Modal, ScrollView, SafeAreaView, Animated, Easing } from 'react-native';
import { Maximize2, X, Accessibility } from 'lucide-react-native';

interface MapViewerProps {
  slots: any[];
  onSelectSlot?: (slot: any) => void;
  selectedSlotId?: string;
  readonly?: boolean;
  isClosed?: boolean;
}

// Central color config so the legend, slot fills, and glow effects always agree.
const STATUS_COLORS: Record<string, { bg: string; border: string; glow: string }> = {
  available: { bg: '#10b981', border: '#047857', glow: '#10b981' },
  reserved: { bg: '#f59e0b', border: '#b45309', glow: '#f59e0b' },
  occupied: { bg: '#f43f5e', border: '#be123c', glow: '#f43f5e' },
  unmapped: { bg: '#64748b', border: '#475569', glow: '#64748b' },
};

function LegendDot({ color, glow = false }: { color: string; glow?: boolean }) {
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        ...(glow
          ? {
              shadowColor: color,
              shadowOpacity: 0.9,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 0 },
              elevation: 4,
            }
          : {}),
      }}
    />
  );
}

function Legend() {
  return (
    <View className="mb-3 px-1">
      <Text className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
        Legend
      </Text>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1">
          <LegendDot color={STATUS_COLORS.available.bg} />
          <Text className="text-[10px] font-bold text-slate-900">Available</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <LegendDot color={STATUS_COLORS.occupied.bg} />
          <Text className="text-[10px] font-bold text-slate-900">Occupied</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <LegendDot color={STATUS_COLORS.reserved.bg} />
          <Text className="text-[10px] font-bold text-slate-900">Reserved</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Accessibility size={11} color="#2563eb" />
          <Text className="text-[10px] font-bold text-slate-900">PWD</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <LegendDot color="#3b82f6" glow />
          <Text className="text-[10px] font-bold text-slate-900">Selected</Text>
        </View>
      </View>
    </View>
  );
}

interface SlotItemProps {
  slot: any;
  cWidth: number;
  cHeight: number;
  isSelected: boolean;
  isClosed: boolean;
  onSelect: (slot: any) => void;
}

function SlotItem({ slot, cWidth, cHeight, isSelected, isClosed, onSelect }: SlotItemProps) {
  const glowAnim = useRef(new Animated.Value(0)).current;

  const isWalkIn = slot.label === "C1" || (slot as any).is_reservable === false || String((slot as any).is_reservable) === "false";
  const isPwd = (slot as any).is_pwd === true || String((slot as any).is_pwd) === "true" || (slot as any).slot_type === 'pwd';
  const isMapped = slot.coordinates && slot.coordinates.length > 0;

  let statusKey: keyof typeof STATUS_COLORS = 'unmapped';
  if (isMapped) {
    if (slot.status === 'reserved') statusKey = 'reserved';
    else if (slot.status === 'available') statusKey = 'available';
    else statusKey = 'occupied';
  }
  const colors = STATUS_COLORS[statusKey];

  // Pulsing halo while this slot is selected — colored to match its own status
  // (green = available, red = occupied, amber = reserved), so the box itself
  // communicates whether it can actually be booked.
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    if (isSelected) {
      glowAnim.setValue(0.4);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.4, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
      loop.start();
    } else {
      glowAnim.setValue(0);
    }
    return () => loop?.stop();
  }, [isSelected]);

  const handlePress = () => {
    if (isClosed || !isMapped) return;
    // Any mapped slot can be tapped to preview it — whether it can actually
    // be reserved is decided by the parent screen (Reserve button stays
    // disabled unless the selected slot's status is "available").
    onSelect(slot);
  };

  const x = typeof slot.ui_x === 'number' ? slot.ui_x : 10;
  const y = typeof slot.ui_y === 'number' ? slot.ui_y : 10;
  const rot = typeof slot.ui_rotation === 'number' ? slot.ui_rotation : 0;
  const scale = typeof slot.ui_scale === 'number' ? slot.ui_scale : 0.8;

  const slotWidth = cWidth * 0.08;
  const slotHeight = cHeight * 0.23;
  const labelFontSize = Math.max(10, cHeight * 0.05);
  const iconSize = Math.max(10, cHeight * 0.055);

  const haloScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const haloOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.55] });

  const fillColor = isClosed ? '#94a3b8' : colors.bg;
  const borderColor = isSelected ? colors.glow : colors.border;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        width: slotWidth,
        height: slotHeight,
        transform: [
          { translateX: -slotWidth / 2 },
          { translateY: -slotHeight / 2 },
          { rotate: `${rot}deg` },
          { scale },
        ],
      }}
    >
      {/* Selection glow halo, colored to match the slot's own status */}
      {isSelected && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: slotWidth,
            height: slotHeight,
            borderRadius: 10,
            backgroundColor: colors.glow,
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
          }}
        />
      )}

      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        style={{
          width: slotWidth,
          height: slotHeight,
          borderRadius: 6,
          borderWidth: isSelected ? 3 : 2,
          borderColor,
          backgroundColor: fillColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: labelFontSize }} className="font-bold text-white">{slot.label}</Text>
        {isMapped && (
          isPwd ? (
            <Accessibility size={iconSize} color="white" />
          ) : isWalkIn ? (
            <X size={iconSize} color="rgba(255,255,255,0.85)" strokeWidth={3} />
          ) : (
            <View
              style={{
                width: iconSize * 0.45,
                height: iconSize * 0.45,
                borderRadius: iconSize * 0.25,
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.85)',
                marginTop: 2,
              }}
            />
          )
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function MapViewer({ slots, onSelectSlot, selectedSlotId, readonly = false, isClosed = false }: MapViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const screenWidth = Dimensions.get('window').width - 32; // 16px padding on sides
  const mapHeight = screenWidth * (9 / 16);

  const fullScreenWidth = Dimensions.get('window').width;
  const fullScreenHeight = fullScreenWidth * (9 / 16);

  const renderSlots = (cWidth: number, cHeight: number) => {
    if (slots.length === 0) {
      return (
        <View className="absolute inset-0 items-center justify-center">
          <Text className="text-slate-400 font-medium">No slots on this floor.</Text>
        </View>
      );
    }

    return slots.map(slot => (
      <SlotItem
        key={slot.id}
        slot={slot}
        cWidth={cWidth}
        cHeight={cHeight}
        isSelected={selectedSlotId === slot.id}
        isClosed={isClosed}
        onSelect={(s) => {
          onSelectSlot && onSelectSlot(s);
          if (isFullscreen) setIsFullscreen(false);
        }}
      />
    ));
  };

  return (
    <>
      <Legend />

      <View
        style={[styles.container, { height: mapHeight }]}
        className="bg-slate-800 rounded-xl overflow-hidden border-2 border-slate-700/50 mb-4 shadow-sm"
      >
        {renderSlots(screenWidth, mapHeight)}

        <TouchableOpacity
          onPress={() => setIsFullscreen(true)}
          className="absolute bottom-3 right-3 bg-slate-900/80 p-2.5 rounded-full z-20 border border-slate-700"
        >
          <Maximize2 size={16} color="white" />
        </TouchableOpacity>
      </View>

      <Modal visible={isFullscreen} animationType="slide" transparent={true}>
        <View className="flex-1 bg-black">
          <SafeAreaView className="absolute top-0 w-full z-10 pointer-events-none">
            <View className="flex-row justify-between items-center px-4 py-3 pointer-events-auto">
              <Text className="text-white font-bold text-lg drop-shadow-md">Floor Map</Text>
              <TouchableOpacity onPress={() => setIsFullscreen(false)} className="bg-slate-800/80 p-2 rounded-full backdrop-blur-md">
                <X size={20} color="white" />
              </TouchableOpacity>
            </View>
            <View className="px-4 pointer-events-auto">
              <Legend />
            </View>
          </SafeAreaView>

          <ScrollView
            style={{ flex: 1 }}
            className="flex-1"
            maximumZoomScale={4}
            minimumZoomScale={1}
            bouncesZoom={true}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingTop: 90 }}
            contentInsetAdjustmentBehavior="never"
          >
            <View
              style={[styles.container, { width: fullScreenWidth, height: fullScreenHeight }]}
              className="bg-slate-800 border-y border-slate-700/50"
            >
              {renderSlots(fullScreenWidth, fullScreenHeight)}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },
});