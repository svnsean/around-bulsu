// src/screens/SearchScreen.js
// Full-screen search page with recent searches, favorites & building browser
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { subscribeToTable } from '../supabase';
import { Icon } from '../components/ui';
import { useSettings } from '../context/SettingsContext';

const RECENTS_KEY = '@around_bulsu/recent_searches';
const FAVORITES_KEY = '@around_bulsu/favorites';
const MAX_RECENTS = 10;

// Ghost-loading image component
const ImageWithGhost = ({ uri, style, resizeMode = 'cover' }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  return (
    <View style={[style, { backgroundColor: '#F3F4F6', overflow: 'hidden' }]}>
      {loading && !error && (
        <View style={[style, { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' }]}>
          <ActivityIndicator size="small" color="#D1D5DB" />
        </View>
      )}
      {error ? (
        <View style={[style, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' }]}>
          <Icon name="image" size={24} color="#D1D5DB" />
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={[style, { position: loading ? 'absolute' : 'relative' }]}
          resizeMode={resizeMode}
          onLoad={() => setLoading(false)}
          onError={() => { setError(true); setLoading(false); }}
        />
      )}
    </View>
  );
};

const SearchScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useSettings();
  const [query, setQuery] = useState('');
  const [buildings, setBuildings] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [blockages, setBlockages] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [activeFilter, setActiveFilter] = useState('buildings'); // 'buildings' | 'recent' | 'favorites' (always one selected)

  // Load recents & favorites on mount
  useEffect(() => {
    loadRecents();
    loadFavorites();
  }, []);

  const loadRecents = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENTS_KEY);
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch (e) {}
  };

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem(FAVORITES_KEY);
      if (stored) setFavorites(JSON.parse(stored));
    } catch (e) {}
  };

  const saveToRecents = async (building) => {
    try {
      const stored = await AsyncStorage.getItem(RECENTS_KEY);
      let recents = stored ? JSON.parse(stored) : [];
      recents = recents.filter((b) => b.id !== building.id);
      recents.unshift(building);
      recents = recents.slice(0, MAX_RECENTS);
      await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
      setRecentSearches(recents);
    } catch (e) {}
  };

  const removeFromRecents = async (buildingId) => {
    try {
      const updated = recentSearches.filter((b) => b.id !== buildingId);
      await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
      setRecentSearches(updated);
    } catch (e) {}
  };

  const toggleFavorite = async (building) => {
    try {
      const isFav = favorites.some((f) => f.id === building.id);
      let updated;
      if (isFav) {
        updated = favorites.filter((f) => f.id !== building.id);
      } else {
        updated = [building, ...favorites];
      }
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
      setFavorites(updated);
    } catch (e) {}
  };

  const isFavorite = (buildingId) => favorites.some((f) => f.id === buildingId);

  // Subscribe to Supabase data
  useEffect(() => {
    const unsubBuildings = subscribeToTable('buildings', setBuildings);
    const unsubNodes = subscribeToTable('nodes', setNodes);
    const unsubEdges = subscribeToTable('edges', setEdges);
    const unsubBlockages = subscribeToTable('blockages', setBlockages);
    return () => {
      unsubBuildings();
      unsubNodes();
      unsubEdges();
      unsubBlockages();
    };
  }, []);

  // Get user location
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation([loc.coords.longitude, loc.coords.latitude]);
      } catch (e) {}
    })();
  }, []);

  // Search logic
  const normalizeForSearch = (str) =>
    (str || '').toLowerCase().replace(/[-_\s]/g, '');

  const filteredBuildings = buildings
    .filter((building) => {
      if (!query.trim()) return false;
      const q = normalizeForSearch(query);
      if (normalizeForSearch(building.name).includes(q)) return true;
      if (building.rooms?.some((r) => normalizeForSearch(r).includes(q))) return true;
      if (building.facilities?.some((f) => normalizeForSearch(f).includes(q))) return true;
      if (building.keywords?.some((k) => normalizeForSearch(k).includes(q))) return true;
      return false;
    })
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const handleSelectBuilding = async (building) => {
    await saveToRecents(building);
    navigation.navigate('BuildingInfo', {
      building,
      userLocation,
      nodes,
      edges,
      blockages,
    });
  };

  // Matching helpers for chip display
  const getMatchingRooms = (building) => {
    if (!query.trim() || !building.rooms) return [];
    const q = normalizeForSearch(query);
    return building.rooms.filter((r) => normalizeForSearch(r).includes(q));
  };

  const getMatchingFacilities = (building) => {
    if (!query.trim() || !building.facilities) return [];
    const q = normalizeForSearch(query);
    return building.facilities.filter((f) => normalizeForSearch(f).includes(q));
  };

  const renderBuildingItem = ({ item, index }) => {
    const matchingRooms = getMatchingRooms(item);
    const matchingFacilities = getMatchingFacilities(item);
    const nameMatches = normalizeForSearch(item.name).includes(normalizeForSearch(query));
    const isRoomSearch = matchingRooms.length > 0 && !nameMatches;
    const isFacilitySearch = matchingFacilities.length > 0 && !nameMatches;
    const hasSubMatches = isRoomSearch || isFacilitySearch;

    return (
      <TouchableOpacity
        style={[styles.buildingRow, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => handleSelectBuilding(item)}
        activeOpacity={0.7}
      >
        {/* Thumbnail */}
        {item.images && item.images.length > 0 ? (
          <ImageWithGhost uri={item.images[0]} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }]}>
            <Icon name="building" size={20} color={colors.textSecondary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.buildingName, { color: colors.textPrimary }]}>{item.name}</Text>

          {isRoomSearch && matchingRooms.length > 0 && (
            <View style={{ marginTop: 6 }}>
              <Text style={styles.matchLabel}>Matching rooms:</Text>
              <View style={styles.chipRow}>
                {matchingRooms.slice(0, 3).map((room, idx) => (
                  <View key={idx} style={[styles.chipMaroon, isDark && { backgroundColor: '#3D1515' }]}>
                    <Text style={styles.chipMaroonText}>{room}</Text>
                  </View>
                ))}
                {matchingRooms.length > 3 && (
                  <Text style={styles.moreText}>+{matchingRooms.length - 3} more</Text>
                )}
              </View>
            </View>
          )}

          {isFacilitySearch && matchingFacilities.length > 0 && (
            <View style={{ marginTop: 6 }}>
              <Text style={styles.matchLabelGreen}>Matching facilities:</Text>
              <View style={styles.chipRow}>
                {matchingFacilities.slice(0, 3).map((f, idx) => (
                  <View key={idx} style={[styles.chipGreen, isDark && { backgroundColor: '#1A3D1A' }]}>
                    <Text style={styles.chipGreenText}>{f}</Text>
                  </View>
                ))}
                {matchingFacilities.length > 3 && (
                  <Text style={styles.moreText}>+{matchingFacilities.length - 3} more</Text>
                )}
              </View>
            </View>
          )}

          {item.description && !hasSubMatches && (
            <Text style={styles.buildingDesc} numberOfLines={1}>
              {item.description}
            </Text>
          )}
        </View>
        {/* Favorite star */}
        <TouchableOpacity
          onPress={() => toggleFavorite(item)}
          style={styles.starBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isFavorite(item.id) ? 'star' : 'star-outline'}
            size={20}
            color={isFavorite(item.id) ? '#F59E0B' : '#D1D5DB'}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderRecentItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.buildingRow, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => handleSelectBuilding(item)}
      activeOpacity={0.7}
    >
      {/* Thumbnail */}
      {item.images && item.images.length > 0 ? (
        <ImageWithGhost uri={item.images[0]} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }]}>
          <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.buildingName, { color: colors.textPrimary }]}>{item.name}</Text>
      </View>
      {/* X to remove */}
      <TouchableOpacity
        onPress={() => removeFromRecents(item.id)}
        style={[styles.removeBtn, { backgroundColor: colors.surface }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // Determine what data to show
  const getListData = () => {
    if (query.trim()) return filteredBuildings;
    if (activeFilter === 'recent') return recentSearches;
    if (activeFilter === 'favorites') return favorites;
    // Default (buildings): show all buildings sorted by name
    return [...buildings].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  };

  const listData = getListData();
  const showRecents = !query.trim() && activeFilter === 'recent';
  const showFavorites = !query.trim() && activeFilter === 'favorites';
  const showAllBuildings = !query.trim() && activeFilter === 'buildings';

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Search</Text>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchBarWrap, { backgroundColor: isDark ? colors.surface : '#E5E7EB' }]}>
        <Ionicons name="search" size={18} color="#B22222" style={{ marginRight: 10 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search buildings or rooms..."
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Pills — mandatory selection, always shown when not searching */}
      {!query.trim() && (
        <View style={styles.pillRow}>
          <TouchableOpacity
            style={[styles.pill, { borderColor: colors.border, backgroundColor: colors.bg }, activeFilter === 'buildings' && styles.pillActive, activeFilter === 'buildings' && isDark && { backgroundColor: '#3D1515' }]}
            onPress={() => setActiveFilter('buildings')}
          >
            <Text style={[styles.pillText, { color: colors.textSecondary }, activeFilter === 'buildings' && styles.pillTextActive]}>
              Buildings
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, { borderColor: colors.border, backgroundColor: colors.bg }, activeFilter === 'recent' && styles.pillActive, activeFilter === 'recent' && isDark && { backgroundColor: '#3D1515' }, { marginLeft: 8 }]}
            onPress={() => setActiveFilter('recent')}
          >
            <Text style={[styles.pillText, { color: colors.textSecondary }, activeFilter === 'recent' && styles.pillTextActive]}>
              Recent
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, { borderColor: colors.border, backgroundColor: colors.bg }, activeFilter === 'favorites' && styles.pillActive, activeFilter === 'favorites' && isDark && { backgroundColor: '#3D1515' }, { marginLeft: 8 }]}
            onPress={() => setActiveFilter('favorites')}
          >
            <Text style={[styles.pillText, { color: colors.textSecondary }, activeFilter === 'favorites' && styles.pillTextActive]}>
              Favorites
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results count when searching */}
      {query.trim().length > 0 && (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {filteredBuildings.length} result{filteredBuildings.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Section label for buildings view */}
      {showAllBuildings && (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            All Buildings
          </Text>
        </View>
      )}

      {/* List */}
      <FlatList
        data={listData}
        renderItem={showRecents ? renderRecentItem : renderBuildingItem}
        keyExtractor={(item) => item.id?.toString() || item.name}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
              <Ionicons
                name={showRecents ? 'time-outline' : showFavorites ? 'star-outline' : 'search-outline'}
                size={28}
                color={colors.textSecondary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              {showRecents ? 'No recent searches' : showFavorites ? 'No favorites yet' : query.trim() ? 'No buildings found' : 'No buildings available'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {showRecents
                ? 'Buildings you search for will appear here'
                : showFavorites
                  ? 'Tap the star icon on any building to save it'
                  : query.trim()
                    ? 'Try a different keyword'
                    : 'Buildings will appear when data is loaded'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111111',
    fontFamily: 'Inter_700Bold',
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111111',
    fontFamily: 'Inter_400Regular',
  },
  clearBtn: { padding: 2 },
  pillRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  pillActive: { borderColor: '#B22222', backgroundColor: '#FFF0F0' },
  pillText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  pillTextActive: { color: '#B22222', fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  resultsHeader: { paddingHorizontal: 20, paddingBottom: 8 },
  resultsCount: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Inter_400Regular',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 20, paddingTop: 4 },
  buildingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#F3F4F6',
  },
  buildingName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    fontFamily: 'Inter_600SemiBold',
  },
  buildingDesc: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
  },
  matchLabel: {
    fontSize: 11,
    color: '#B22222',
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: 'Inter_600SemiBold',
  },
  matchLabelGreen: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: 'Inter_600SemiBold',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chipMaroon: {
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginRight: 6,
    marginBottom: 4,
  },
  chipMaroonText: {
    fontSize: 11,
    color: '#B22222',
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  chipGreen: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginRight: 6,
    marginBottom: 4,
  },
  chipGreenText: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  moreText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    alignSelf: 'center',
  },
  starBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
});

export default SearchScreen;
