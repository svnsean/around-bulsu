// src/components/SearchBottomSheet.js
import React, { useState, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import { Icon } from './ui';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 102; // Floating tab bar height (70) + margin (16) + extra padding (16)
const MENU_BUTTON_HEIGHT = 70; // Space for menu button at top
const SHEET_MIN_HEIGHT = 100 + TAB_BAR_HEIGHT;
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT - MENU_BUTTON_HEIGHT; // Go nearly full height but leave room for menu button

const SearchBottomSheet = forwardRef(({ buildings, onSelectBuilding }, ref) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sheetHeight] = useState(new Animated.Value(SHEET_MIN_HEIGHT));
  const [isExpanded, setIsExpanded] = useState(false);

  // Search logic - searches both building names and rooms, sorted alphabetically
  const filteredBuildings = buildings
    .filter((building) => {
      if (!searchQuery.trim()) return true;
      
      const query = searchQuery.toLowerCase();
      
      // Search by building name
      if (building.name?.toLowerCase().includes(query)) return true;
      
      // Search by room name
      if (building.rooms && Array.isArray(building.rooms)) {
        return building.rooms.some(room => 
          room.toLowerCase().includes(query)
        );
      }
      
      return false;
    })
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Pan responder for drag gesture
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      const newHeight = isExpanded 
        ? SHEET_MAX_HEIGHT - gestureState.dy 
        : SHEET_MIN_HEIGHT - gestureState.dy;
      
      if (newHeight >= SHEET_MIN_HEIGHT && newHeight <= SHEET_MAX_HEIGHT) {
        sheetHeight.setValue(newHeight);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy < -50) {
        expand();
      } else if (gestureState.dy > 50) {
        collapse();
      } else {
        Animated.spring(sheetHeight, {
          toValue: isExpanded ? SHEET_MAX_HEIGHT : SHEET_MIN_HEIGHT,
          useNativeDriver: false,
        }).start();
      }
    },
  });

  const expand = () => {
    setIsExpanded(true);
    Animated.spring(sheetHeight, {
      toValue: SHEET_MAX_HEIGHT,
      useNativeDriver: false,
    }).start();
  };

  const collapse = () => {
    setIsExpanded(false);
    Animated.spring(sheetHeight, {
      toValue: SHEET_MIN_HEIGHT,
      useNativeDriver: false,
    }).start();
  };

  useImperativeHandle(ref, () => ({
    expand,
    collapse,
    close: collapse,
  }));

  const handleBuildingPress = (building) => {
    onSelectBuilding(building);
    collapse();
  };

  const getMatchingRooms = (building) => {
    if (!searchQuery.trim() || !building.rooms) return [];
    
    const query = searchQuery.toLowerCase();
    return building.rooms.filter(room => 
      room.toLowerCase().includes(query)
    );
  };

  const renderBuildingItem = ({ item }) => {
    const matchingRooms = getMatchingRooms(item);
    const isRoomSearch = matchingRooms.length > 0 && !item.name?.toLowerCase().includes(searchQuery.toLowerCase());

    return (
      <TouchableOpacity 
        className="flex-row items-center py-4 px-4 mb-2 bg-gray-50 rounded-2xl border border-gray-100 active:bg-gray-100"
        onPress={() => handleBuildingPress(item)}
      >
        <View className="w-11 h-11 rounded-xl bg-maroon-100 items-center justify-center mr-4">
          <Icon name="building" size={20} color="#800000" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900 mb-0.5">{item.name}</Text>
          
          {isRoomSearch && matchingRooms.length > 0 && (
            <View className="mt-1.5">
              <Text className="text-xs text-maroon-700 font-semibold mb-1">Matching rooms:</Text>
              <View className="flex-row flex-wrap">
                {matchingRooms.slice(0, 3).map((room, idx) => (
                  <View 
                    key={idx} 
                    className="bg-maroon-100 px-2 py-0.5 rounded-full mr-1.5 mb-1"
                  >
                    <Text className="text-xs text-maroon-800 font-medium">{room}</Text>
                  </View>
                ))}
                {matchingRooms.length > 3 && (
                  <Text className="text-xs text-gray-400 italic self-center">
                    +{matchingRooms.length - 3} more
                  </Text>
                )}
              </View>
            </View>
          )}
          
          {item.description && !isRoomSearch && (
            <Text className="text-sm text-gray-500" numberOfLines={1}>
              {item.description}
            </Text>
          )}
        </View>
        
        <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center ml-2">
          <Icon name="chevron-right" size={18} color="#6B7280" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View 
      className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl"
      style={[{ height: sheetHeight }, styles.containerShadow]}
    >
      {/* Drag Handle */}
      <View {...panResponder.panHandlers} className="items-center py-4">
        <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
      </View>

      {/* Search Bar */}
      <TouchableOpacity 
        className="flex-row items-center mx-4 mb-3 px-4 py-2.5 bg-gray-100 rounded-xl border border-gray-200"
        onPress={expand}
        activeOpacity={1}
      >
        <Icon name="search" size={18} color="#800000" style={{ marginRight: 10 }} />
        <TextInput
          className="flex-1 text-sm text-gray-800"
          placeholder="Search buildings or rooms..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={expand}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity 
            onPress={() => setSearchQuery('')}
            className="w-7 h-7 items-center justify-center rounded-full bg-gray-200"
          >
            <Icon name="x" size={14} color="#6B7280" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Results List */}
      {isExpanded && (
        <View className="flex-1 px-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
              {filteredBuildings.length} building{filteredBuildings.length !== 1 ? 's' : ''} found
            </Text>
            <Text className="text-xs text-gray-400">A-Z</Text>
          </View>
          
          <FlatList
            data={filteredBuildings}
            renderItem={renderBuildingItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <View className="items-center py-12">
                <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-4">
                  <Icon name="search" size={28} color="#D1D5DB" />
                </View>
                <Text className="text-base font-semibold text-gray-500 mb-1">
                  No buildings found
                </Text>
                <Text className="text-sm text-gray-400 text-center px-8">
                  Try searching with a different term
                </Text>
              </View>
            }
          />
        </View>
      )}
    </Animated.View>
  );
});

// Minimal styles for shadow (NativeWind shadow limited on Android)
const styles = StyleSheet.create({
  containerShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
});

export default SearchBottomSheet;
