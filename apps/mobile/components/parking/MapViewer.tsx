import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

interface MapViewerProps {
  slots: any[];
  onSelectSlot?: (slot: any) => void;
  selectedSlotId?: string;
}

export default function MapViewer({ slots, onSelectSlot, selectedSlotId }: MapViewerProps) {
  // Use a fixed aspect ratio container, similar to 16:9 or roughly the screen width
  const screenWidth = Dimensions.get('window').width - 32; // 16px padding on sides
  const mapHeight = screenWidth * (9 / 16); 

  return (
    <View 
      style={[styles.container, { height: mapHeight }]}
      className="bg-slate-800 rounded-xl overflow-hidden border-2 border-slate-700/50 my-4 shadow-sm"
    >
      {slots.length === 0 ? (
        <View className="absolute inset-0 items-center justify-center">
           <Text className="text-slate-400 font-medium">No slots on this floor.</Text>
        </View>
      ) : (
        slots.map(slot => {
          const isSelected = selectedSlotId === slot.id;
          const x = typeof slot.ui_x === 'number' ? slot.ui_x : 10;
          const y = typeof slot.ui_y === 'number' ? slot.ui_y : 10;
          const rot = typeof slot.ui_rotation === 'number' ? slot.ui_rotation : 0;
          
          const isMapped = slot.coordinates && slot.coordinates.length > 0;
          let bgColor = "bg-slate-500 border-slate-400"; // unmapped
          if (isMapped) {
            bgColor = slot.status === "available" ? "bg-emerald-500 border-emerald-700" : "bg-rose-500 border-rose-700";
          }
          
          return (
            <TouchableOpacity
              key={slot.id}
              onPress={() => onSelectSlot && onSelectSlot(slot)}
              style={[
                styles.slot,
                {
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: [{ rotate: `${rot}deg` }],
                  // Make slots a bit smaller on mobile to fit nicely
                  width: screenWidth * 0.12, 
                  height: mapHeight * 0.25,
                }
              ]}
              className={`${bgColor} border-b-4 items-center justify-center rounded shadow-sm ${isSelected ? 'border-white border-2 border-b-4' : ''}`}
              activeOpacity={0.7}
            >
              <Text className="font-bold text-white text-xs">{slot.label}</Text>
              {isMapped && (
                <Text className="text-[8px] text-white/80 font-bold mt-0.5">
                  {slot.status === 'available' ? 'P' : 'X'}
                </Text>
              )}
            </TouchableOpacity>
          )
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    // grid pattern
  },
  slot: {
    position: 'absolute',
  }
});
