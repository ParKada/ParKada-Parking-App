import re

with open(r'c:\Users\iamga\Desktop\ParKada_Thesis\apps\mobile\app\(app)\map.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Marker logic
marker_search = """              const statusText = isClosed ? "Closed" : isAccredited ? `${lot.available_slots} slots` : "Walk-in Only";

              return (
                <Marker
                  key={`marker-${lot.id}`}
                  coordinate={{ latitude: Number(lot.latitude), longitude: Number(lot.longitude) }}
                  anchor={{ x: 0.5, y: 1 }}
                  onPress={() => { if (isAccredited) handleSelectLot(lot); }}
                >
                  <View pointerEvents="none" style={{ alignItems: 'center', width: 150 }}>
                    <View
                      style={{
                        backgroundColor: pinColor,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 10,
                        marginBottom: 3,
                      }}
                    >
                      <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>{statusText}</Text>
                    </View>"""
marker_replace = """              const statusText = isClosed ? "Closed" : isAccredited ? `${lot.available_slots} slots` : "";

              return (
                <Marker
                  key={`marker-${lot.id}`}
                  coordinate={{ latitude: Number(lot.latitude), longitude: Number(lot.longitude) }}
                  anchor={{ x: 0.5, y: 1 }}
                  onPress={() => { if (isAccredited) handleSelectLot(lot); }}
                >
                  <View pointerEvents="none" style={{ alignItems: 'center', width: 150 }}>
                    {isAccredited && (
                    <View
                      style={{
                        backgroundColor: pinColor,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 10,
                        marginBottom: 3,
                      }}
                    >
                      <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>{statusText}</Text>
                    </View>
                    )}"""
if marker_search in content:
    content = content.replace(marker_search, marker_replace)
    print("Replaced marker rendering!")
else:
    print("Could not find marker search block")

# 2. Add helper renderLotCard right before `return (`
card_helper = """
  const renderLotCard = (lot: any, isHorizontal: boolean) => {
    const isClosed = lot.open_hours ? !isParkingOpen(lot.open_hours, currentTime) : lot.status === 'closed';
    const isFav = isFavorite(lot.id);
    const isAccredited = lot.is_accredited === true;

    return (
      <TouchableOpacity
        key={`card-${lot.id}`}
        disabled={!isAccredited}
        onPress={() => handleSelectLot(lot)}
        className={`bg-white border border-slate-100 rounded-2xl p-4 shadow-sm ${isHorizontal ? 'w-72 mr-4' : 'w-full mb-3'} ${(!isAccredited || isClosed) ? "opacity-80" : ""}`}
      >
        <View className="flex-row justify-between items-start mb-1">
          <Text className="font-black text-slate-800 text-sm flex-1 mr-2" numberOfLines={1}>{lot.name}</Text>
          <TouchableOpacity 
            onPress={(e) => { e.stopPropagation(); toggleFavorite(lot.id); }} 
            className="p-1" activeOpacity={0.7}
          >
            <Heart size={18} color={isFav ? "#f43f5e" : "#cbd5e1"} fill={isFav ? "#f43f5e" : "transparent"} />
          </TouchableOpacity>
        </View>
        
        <View className="flex-row items-center gap-2 mb-3">
          <View className="border border-slate-200 px-1.5 py-0.5 rounded-md"><Text className="text-[8px] font-bold text-slate-500 uppercase">{lot.type}</Text></View>
          <Text className="text-[10px] font-bold text-slate-500">
            {isClosed ? "Closed" : isAccredited ? (lot.pricing_scheme === 'fixed' ? `₱${lot.fixed_rate} Whole Day` : `₱${lot.base_rate} First ${lot.base_rate_hours || 3}Hrs`) : "Walk-In Only"}
          </Text>
          {lot.currentDistance !== null && (
            <Text className="text-[10px] font-black text-blue-600 ml-auto">{lot.currentDistance.toFixed(1)} km</Text>
          )}
        </View>

        <View className="flex-row gap-1.5 mt-auto">
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleShowRoute(Number(lot.latitude), Number(lot.longitude)); }} className="flex-1 bg-blue-50 py-2 rounded-lg items-center flex-row justify-center gap-1">
            {isFetchingRoute ? <ActivityIndicator size="small" color="#2563EB" /> : <RouteIcon size={12} color="#2563EB" />}
            <Text className="text-[9px] font-black text-blue-600">ROUTE</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); openMaps(Number(lot.latitude), Number(lot.longitude), "google"); }} className="flex-1 bg-emerald-500 py-2 rounded-lg items-center flex-row justify-center gap-1">
            <Map size={12} color="white" />
            <Text className="text-[9px] font-black text-white">GMAPS</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); openMaps(Number(lot.latitude), Number(lot.longitude), "waze"); }} className="flex-1 bg-[#33CCFF] py-2 rounded-lg items-center flex-row justify-center gap-1">
            <Navigation size={12} color="white" />
            <Text className="text-[9px] font-black text-white">WAZE</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
"""
content = content.replace("  return (\n    <View className=", card_helper + "    <View className=", 1)

# 3. Refactor bottom sheet rendering
bottom_sheet_search = """              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="overflow-visible pb-2 flex-row px-4">
                {filteredAndSorted.map(lot => {
                  const isClosed = lot.open_hours ? !isParkingOpen(lot.open_hours, currentTime) : lot.status === 'closed';
                  const isFav = isFavorite(lot.id);
                  const isAccredited = lot.is_accredited === true;

                  return (
                    <TouchableOpacity
                      key={`card-${lot.id}`}
                      disabled={!isAccredited}
                      onPress={() => handleSelectLot(lot)}
                      className={`w-72 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm mr-4 ${(!isAccredited || isClosed) ? "opacity-80" : ""}`}
                    >
                      <View className="flex-row justify-between items-start mb-1">
                        <Text className="font-black text-slate-800 text-sm flex-1 mr-2" numberOfLines={1}>{lot.name}</Text>
                        <TouchableOpacity 
                          onPress={(e) => {
                            e.stopPropagation();
                            toggleFavorite(lot.id);
                          }} 
                          className="p-1"
                          activeOpacity={0.7}
                        >
                          <Heart size={18} color={isFav ? "#f43f5e" : "#cbd5e1"} fill={isFav ? "#f43f5e" : "transparent"} />
                        </TouchableOpacity>
                      </View>
                      
                      <View className="flex-row items-center gap-2 mb-3">
                        <View className="border border-slate-200 px-1.5 py-0.5 rounded-md"><Text className="text-[8px] font-bold text-slate-500 uppercase">{lot.type}</Text></View>
                        <Text className="text-[10px] font-bold text-slate-500">
                          {isClosed ? "Closed" : isAccredited ? (lot.pricing_scheme === 'fixed' ? `₱${lot.fixed_rate} Whole Day` : `₱${lot.base_rate} First ${lot.base_rate_hours || 3}Hrs`) : "Walk-In Only"}
                        </Text>
                        {lot.currentDistance !== null && (
                          <Text className="text-[10px] font-black text-blue-600 ml-auto">{lot.currentDistance.toFixed(1)} km</Text>
                        )}
                      </View>

                      <View className="flex-row gap-1.5 mt-auto">
                        <TouchableOpacity 
                          onPress={(e) => {
                            e.stopPropagation();
                            handleShowRoute(Number(lot.latitude), Number(lot.longitude));
                          }} 
                          className="flex-1 bg-blue-50 py-2 rounded-lg items-center flex-row justify-center gap-1"
                        >
                          {isFetchingRoute ? <ActivityIndicator size="small" color="#2563EB" /> : <RouteIcon size={12} color="#2563EB" />}
                          <Text className="text-[9px] font-black text-blue-600">ROUTE</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={(e) => {
                            e.stopPropagation();
                            openMaps(Number(lot.latitude), Number(lot.longitude), "google");
                          }} 
                          className="flex-1 bg-emerald-500 py-2 rounded-lg items-center flex-row justify-center gap-1"
                        >
                          <Map size={12} color="white" />
                          <Text className="text-[9px] font-black text-white">GMAPS</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={(e) => {
                            e.stopPropagation();
                            openMaps(Number(lot.latitude), Number(lot.longitude), "waze");
                          }} 
                          className="flex-1 bg-[#33CCFF] py-2 rounded-lg items-center flex-row justify-center gap-1"
                        >
                          <Navigation size={12} color="white" />
                          <Text className="text-[9px] font-black text-white">WAZE</Text>
                        </TouchableOpacity>

                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>"""

bottom_sheet_replace = """              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="overflow-visible pb-2 flex-row px-4">
                  {filteredAndSorted.filter(lot => lot.is_accredited).map(lot => renderLotCard(lot, true))}
                </ScrollView>
                
                {filteredAndSorted.filter(lot => !lot.is_accredited).length > 0 && (
                  <View className="mt-4 px-4 pb-4">
                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Others</Text>
                    {filteredAndSorted.filter(lot => !lot.is_accredited).map(lot => renderLotCard(lot, false))}
                  </View>
                )}
              </ScrollView>"""

if bottom_sheet_search in content:
    content = content.replace(bottom_sheet_search, bottom_sheet_replace)
    print("Replaced bottom sheet rendering!")
else:
    print("Could not find bottom sheet search block")

with open(r'c:\Users\iamga\Desktop\ParKada_Thesis\apps\mobile\app\(app)\map.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
