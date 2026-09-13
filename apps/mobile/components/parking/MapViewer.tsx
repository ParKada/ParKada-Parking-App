import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Modal, Animated, Easing, PanResponder, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Maximize2, X, Accessibility, RotateCcw } from 'lucide-react-native';

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

// `dark` switches the label color for use on dark surfaces (e.g. the
// fullscreen header, which is a near-black overlay). Without this the
// legend used near-black text (`text-slate-900`) unconditionally, which is
// effectively invisible on that background.
function Legend({ dark = false }: { dark?: boolean }) {
  const labelClass = dark ? 'text-[10px] font-bold text-white' : 'text-[10px] font-bold text-slate-900';
  const titleClass = dark
    ? 'text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5'
    : 'text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5';

  return (
    <View className="mb-3 px-1">
      <Text className={titleClass}>Legend</Text>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1">
          <LegendDot color={STATUS_COLORS.available.bg} />
          <Text className={labelClass}>Available</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <LegendDot color={STATUS_COLORS.occupied.bg} />
          <Text className={labelClass}>Occupied</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <LegendDot color={STATUS_COLORS.reserved.bg} />
          <Text className={labelClass}>Reserved</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Accessibility size={11} color="#2563eb" />
          <Text className={labelClass}>PWD</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <LegendDot color="#3b82f6" glow />
          <Text className={labelClass}>Selected</Text>
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

  // Walk-in-only slots (PWD bays, C1, or anything explicitly flagged
  // is_reservable: false) can never be selected for an online reservation.
  // They still render with their normal status color (so a green walk-in
  // slot still reads as "physically available") — only the tap behavior
  // differs: instead of selecting the slot, it shows an explanatory alert.
  const isSelectable = !isWalkIn && !isPwd;

  // Visibility is decided upstream (status !== "unmapped"), so any slot that
  // reaches this component should render using its real status. The
  // "coordinates" field is unrelated — that's only used for the AI camera
  // zone, not for whether a slot shows up on this floor map.
  let statusKey: keyof typeof STATUS_COLORS = 'unmapped';
  if (slot.status === 'reserved') statusKey = 'reserved';
  else if (slot.status === 'available') statusKey = 'available';
  else if (slot.status === 'occupied') statusKey = 'occupied';
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
    if (isClosed) return;

    if (!isSelectable) {
      Alert.alert(
        "Walk-in Only",
        "Available only for walk-in. You can't reserve this slot."
      );
      // Still populate the selected-slot info card upstream, so the parent
      // screen can show a "Walk-In Slots Only" label instead of nothing.
      onSelect(slot);
      return;
    }

    onSelect(slot);
};

  const x = typeof slot.ui_x === 'number' ? slot.ui_x : 10;
  const y = typeof slot.ui_y === 'number' ? slot.ui_y : 10;
  const rot = typeof slot.ui_rotation === 'number' ? slot.ui_rotation : 0;
  const scale = typeof slot.ui_scale === 'number' ? slot.ui_scale : 0.8;

  // Sized to match the ~15–20% step spacing used when the admin places
  // slots on the map. The previous values (0.095 / 0.27) were much larger
  // than that spacing, so neighboring slots visually overlapped even when
  // their ui_x/ui_y coordinates were correctly spaced apart.
  const slotWidth = cWidth * 0.075;
  const slotHeight = cHeight * 0.16;
  const labelFontSize = Math.max(10, cHeight * 0.035);
  const iconSize = Math.max(10, cHeight * 0.04);

  const haloScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const haloOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.55] });

  // Status color is preserved for ALL slots, including walk-in/PWD ones —
  // only tap behavior differs, not appearance.
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
        disabled={isClosed}
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
          // Reservable slots get a thicker amber accent along the bottom
          // edge, matching the admin dashboard's convention for
          // distinguishing reservable vs. walk-in/PWD slots at a glance.
          ...(!isWalkIn
            ? { borderBottomWidth: 4, borderBottomColor: '#fbbf24' }
            : { borderBottomWidth: isSelected ? 3 : 2 }),
        }}
      >
        <Text style={{ fontSize: labelFontSize }} className="font-bold text-white">{slot.label}</Text>
        {isPwd ? (
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
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function MapViewer({ slots, onSelectSlot, selectedSlotId, readonly = false, isClosed = false }: MapViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showResetHint, setShowResetHint] = useState(false);

  const screenWidth = Dimensions.get('window').width - 32; // 16px padding on sides
  const mapHeight = screenWidth * (9 / 16);

  const fullScreenWidth = Dimensions.get('window').width;
  const fullScreenHeight = fullScreenWidth * (9 / 16);

  // --- Custom cross-platform pinch-to-zoom + pan ---
  // ScrollView's maximumZoomScale/minimumZoomScale/bouncesZoom are iOS-only
  // in React Native and are silently ignored on Android, which is why pinch
  // zoom never worked there. This PanResponder-based implementation tracks
  // raw touches, so it works the same way on both platforms.
  const MIN_SCALE = 1;
  const MAX_SCALE = 4;
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const lastScale = useRef(1);
  const lastDistance = useRef(0);
  const lastTranslate = useRef({ x: 0, y: 0 });
  const lastTapTime = useRef(0);

  const getDistance = (touches: any[]) => {
    const [a, b] = touches;
    return Math.sqrt(Math.pow(a.pageX - b.pageX, 2) + Math.pow(a.pageY - b.pageY, 2));
  };

  const animateReset = () => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    lastScale.current = 1;
    lastTranslate.current = { x: 0, y: 0 };
    lastDistance.current = 0;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length >= 1,
      onMoveShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length >= 1,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          lastDistance.current = getDistance(touches);
        } else if (touches.length === 1) {
          // Double-tap-to-reset: two single-finger taps within 300ms.
          const now = Date.now();
          if (now - lastTapTime.current < 300) {
            animateReset();
            lastTapTime.current = 0;
          } else {
            lastTapTime.current = now;
          }
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          const distance = getDistance(touches);
          if (lastDistance.current > 0) {
            const nextScale = Math.max(
              MIN_SCALE,
              Math.min(MAX_SCALE, lastScale.current * (distance / lastDistance.current))
            );
            scale.setValue(nextScale);
          }
        } else if (touches.length === 1 && lastScale.current > 1) {
          // Only pan while zoomed in — otherwise a single-finger drag would
          // fight with tapping a slot.
          translateX.setValue(lastTranslate.current.x + gestureState.dx);
          translateY.setValue(lastTranslate.current.y + gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        // @ts-ignore - _value is available on Animated.Value at runtime
        const currentScale = (scale as any)._value ?? lastScale.current;
        lastScale.current = currentScale;
        if (evt.nativeEvent.changedTouches.length === 1 && currentScale > 1) {
          lastTranslate.current = {
            x: lastTranslate.current.x + gestureState.dx,
            y: lastTranslate.current.y + gestureState.dy,
          };
        }
        lastDistance.current = 0;
        setShowResetHint(currentScale > 1.02);
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const resetZoom = () => {
    scale.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);
    lastScale.current = 1;
    lastTranslate.current = { x: 0, y: 0 };
    lastDistance.current = 0;
    setShowResetHint(false);
  };

  useEffect(() => {
    if (isFullscreen) resetZoom();
  }, [isFullscreen]);

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
          {/* Pinch-to-zoom / pan area, sits below the header overlay */}
          <View
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
            {...panResponder.panHandlers}
          >
            <Animated.View
              style={{
                width: fullScreenWidth,
                height: fullScreenHeight,
                transform: [
                  { translateX },
                  { translateY },
                  { scale },
                ],
              }}
            >
              <View
                style={[styles.container, { width: fullScreenWidth, height: fullScreenHeight }]}
                className="bg-slate-800 border-y border-slate-700/50"
              >
                {renderSlots(fullScreenWidth, fullScreenHeight)}
              </View>
            </Animated.View>
          </View>

          {/* Floating reset-zoom button — only shown once the user has
              actually zoomed in, so it doesn't clutter the view at rest. */}
          {showResetHint && (
            <TouchableOpacity
              onPress={animateReset}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="absolute bottom-6 self-center bg-slate-900/90 px-4 py-2.5 rounded-full border border-slate-700 flex-row items-center gap-2"
              style={{ zIndex: 40, elevation: 14, left: '50%', transform: [{ translateX: -55 }] }}
            >
              <RotateCcw size={14} color="white" />
              <Text className="text-white font-bold text-xs">Reset zoom</Text>
            </TouchableOpacity>
          )}

          {/* Header overlay: title, close button, legend. Solid background +
              explicit elevation so it reliably sits above the map on Android
              (where zIndex alone isn't always enough for sibling stacking). */}
          <SafeAreaView
            edges={['top']}
            pointerEvents="box-none"
            style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
          >
            <View
              style={{
                backgroundColor: 'rgba(2, 6, 23, 0.96)',
                paddingBottom: 10,
                elevation: 12,
                zIndex: 50,
              }}
            >
              <View className="flex-row justify-between items-center px-4 py-3">
                <Text className="text-white font-bold text-lg">Floor Map</Text>
                <TouchableOpacity
                  onPress={() => setIsFullscreen(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  className="bg-slate-800 p-2 rounded-full"
                  style={{ elevation: 13 }}
                >
                  <X size={20} color="white" />
                </TouchableOpacity>
              </View>
              <View className="px-4">
                <Legend dark />
              </View>
              <Text className="text-center text-[10px] text-slate-400 font-semibold -mt-1">
                Pinch to zoom · drag to pan · double-tap or use Reset zoom to return to normal
              </Text>
            </View>
          </SafeAreaView>
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