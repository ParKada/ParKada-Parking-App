import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Modal, ScrollView, SafeAreaView } from 'react-native';
import { Maximize2, X } from 'lucide-react-native';

interface MapViewerProps {
  slots: any[];
  onSelectSlot?: (slot: any) => void;
  selectedSlotId?: string;
  readonly?: boolean;
  isClosed?: boolean;
}

export default function MapViewer({ slots, onSelectSlot, selectedSlotId, readonly = false, isClosed = false }: MapViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Use a fixed aspect ratio container, similar to 16:9 or roughly the screen width
  const screenWidth = Dimensions.get('window').width - 32; // 16px padding on sides
  const mapHeight = screenWidth * (9 / 16); 
  
  // Fullscreen dimensions (edge to edge)
  // Fullscreen dimensions (normal dimensions, fitting the screen)
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
    
    return slots.map(slot => {
      const isSelected = selectedSlotId === slot.id;
      const x = typeof slot.ui_x === 'number' ? slot.ui_x : 10;
      const y = typeof slot.ui_y === 'number' ? slot.ui_y : 10;
      const rot = typeof slot.ui_rotation === 'number' ? slot.ui_rotation : 0;
      const scale = typeof slot.ui_scale === 'number' ? slot.ui_scale : 0.8;
      
      const slotWidth = cWidth * 0.08;
      const slotHeight = cHeight * 0.23;
      
      const labelFontSize = Math.max(10, cHeight * 0.05);
      const iconFontSize = Math.max(8, cHeight * 0.04);
      
      const isWalkIn = slot.label === "C1" || (slot as any).is_reservable === false || String((slot as any).is_reservable) === "false";

      const isMapped = slot.coordinates && slot.coordinates.length > 0;
      let bgColor = "bg-slate-500 border-slate-400"; // unmapped
      if (isMapped) {
        if (isClosed) {
          bgColor = "bg-slate-400 border-slate-500 opacity-80";
        } else {
          bgColor = slot.status === "available" ? "bg-emerald-500 border-emerald-700" : "bg-rose-500 border-rose-700";
          if (slot.status === "reserved") bgColor = "bg-amber-500 border-amber-600";
        }
      }
      
      return (
        <TouchableOpacity
          key={slot.id}
          onPress={() => {
            onSelectSlot && onSelectSlot(slot);
            if (isFullscreen) setIsFullscreen(false); // optionally close modal on select
          }}
          style={[
            styles.slot,
            {
              left: `${x}%`,
              top: `${y}%`,
              width: slotWidth, 
              height: slotHeight,
              transform: [
                { translateX: -slotWidth / 2 },
                { translateY: -slotHeight / 2 },
                { rotate: `${rot}deg` },
                { scale: scale }
              ],
              ...(isSelected ? { borderWidth: 3, borderColor: '#3b82f6', zIndex: 10 } : {})
            }
          ]}
          className={`${bgColor} items-center justify-center rounded shadow-sm ${
            !isWalkIn ? 'border-2 border-amber-400 border-b-4' : 'border-0 border-b-4'
          }`}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: labelFontSize }} className="font-bold text-white">{slot.label}</Text>
          {isMapped && (
            <Text style={{ fontSize: iconFontSize }} className={`font-bold mt-0.5 ${isWalkIn ? 'text-white/70' : 'text-amber-200'}`}>
              {isWalkIn ? 'X' : '★'}
            </Text>
          )}
        </TouchableOpacity>
      )
    });
  };

  return (
    <>
      <View 
        style={[styles.container, { height: mapHeight }]}
        className="bg-slate-800 rounded-xl overflow-hidden border-2 border-slate-700/50 my-4 shadow-sm"
      >
        {renderSlots(screenWidth, mapHeight)}
        
        {/* Fullscreen Button */}
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
          </SafeAreaView>
          
          <ScrollView 
            style={{ flex: 1 }}
            className="flex-1"
            maximumZoomScale={4} 
            minimumZoomScale={1} 
            bouncesZoom={true}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
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
  slot: {
    position: 'absolute',
  }
});
