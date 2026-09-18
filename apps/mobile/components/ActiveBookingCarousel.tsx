import { useCallback, useEffect, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import ActiveBookingCard from "./ActiveBookingCard";
import type { ActiveBooking } from "../lib/types";

/** Horizontal breathing room contributed by the `mx-4` wrapper on Home. */
const SCREEN_GUTTER = 32;

interface ActiveBookingCarouselProps {
  bookings: ActiveBooking[];
  /** Booking that should currently be on screen. */
  selectedId: string | null;
  /** Fires when the user swipes to a different booking. */
  onSelect: (bookingId: string) => void;
  /** Opens the receipt for a booking. */
  onPressBooking: (bookingId: string) => void;
  /** Refresh callback handed to every timer (extend / pay fine). */
  onUpdate: () => void;
}

/**
 * Swipeable pager of active bookings. With a single booking it degrades to a
 * plain card; with several the driver swipes left/right to reveal each
 * booking's own running countdown.
 */
export default function ActiveBookingCarousel({
  bookings,
  selectedId,
  onSelect,
  onPressBooking,
  onUpdate,
}: ActiveBookingCarouselProps) {
  const { width: windowWidth } = useWindowDimensions();
  const pageWidth = Math.max(windowWidth - SCREEN_GUTTER, 1);

  const scrollRef = useRef<ScrollView>(null);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const hasMultiple = bookings.length > 1;

  // Follow the selected booking when the parent swaps it out (e.g. the
  // selected reservation finished and the list re-ordered after a refresh).
  useEffect(() => {
    const index = selectedId
      ? bookings.findIndex((booking) => booking.id === selectedId)
      : -1;
    const target = index >= 0 ? index : 0;
    if (target === activeIndexRef.current) return;
    activeIndexRef.current = target;
    setActiveIndex(target);
    scrollRef.current?.scrollTo({ x: target * pageWidth, animated: false });
  }, [selectedId, bookings, pageWidth]);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0) return;
      const rawIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      const index = Math.min(Math.max(rawIndex, 0), bookings.length - 1);
      if (index === activeIndexRef.current) return;
      activeIndexRef.current = index;
      setActiveIndex(index);
      const booking = bookings[index];
      if (booking) onSelect(booking.id);
    },
    [bookings, onSelect, pageWidth],
  );

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        decelerationRate="fast"
        snapToInterval={pageWidth}
        snapToAlignment="start"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEventThrottle={16}
      >
        {bookings.map((booking, index) => (
          <View key={booking.id} style={{ width: pageWidth }}>
            <ActiveBookingCard
              booking={booking}
              onPress={() => onPressBooking(booking.id)}
              onUpdate={onUpdate}
              positionLabel={hasMultiple ? `${index + 1} of ${bookings.length}` : undefined}
            />
          </View>
        ))}
      </ScrollView>

      {hasMultiple && (
        <View className="flex-row items-center justify-center gap-3 mt-3">
          <ChevronLeft size={14} color="#94a3b8" />
          <View className="flex-row items-center gap-1.5">
            {bookings.map((booking, index) => (
              <View
                key={booking.id}
                className={
                  index === activeIndex
                    ? "h-1.5 w-5 rounded-full bg-blue-600"
                    : "h-1.5 w-1.5 rounded-full bg-slate-300"
                }
              />
            ))}
          </View>
          <ChevronRight size={14} color="#94a3b8" />
        </View>
      )}

      {hasMultiple && (
        <Text className="text-center text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">
          Swipe to see your other booking
          {bookings.length > 2 ? "s" : ""}
        </Text>
      )}
    </View>
  );
}
