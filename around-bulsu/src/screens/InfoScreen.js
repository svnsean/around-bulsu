// src/screens/InfoScreen.js - Campus Information Tab with NativeWind
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  Linking,
  RefreshControl,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Icon, ContactListSkeleton, BuildingListSkeleton, AnimatedCard, AnimatedListItem } from '../components/ui';
import { supabase, subscribeToTable } from '../supabase';
import * as Haptics from 'expo-haptics';
import { useThemeColors, useSettings } from '../context/SettingsContext';

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
          <Icon name="image" size={28} color="#D1D5DB" />
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

// Icon with circle background component
const IconCircle = ({ name, size, color, bgColor, circleSize }) => (
  <View 
    style={{ 
      width: circleSize, 
      height: circleSize, 
      borderRadius: circleSize / 2, 
      backgroundColor: bgColor,
      alignItems: 'center',
      justifyContent: 'center'
    }}
  >
    <Feather name={name} size={size} color={color} />
  </View>
);

const TABS = ['Contacts', 'Buildings', 'Announcements'];

// White header component
const SafeHeader = ({ title, colors }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: colors.bg, borderBottomWidth: 0, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 32, fontWeight: '700', fontFamily: 'Inter_700Bold', color: colors.textPrimary }}>{title}</Text>
    </View>
  );
};

const InfoScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('Contacts');
  const [contacts, setContacts] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { isDark, colors } = useSettings();

  // Supabase listeners
  useEffect(() => {
    const unsubContacts = subscribeToTable('emergency_contacts', (data) => {
      setContacts(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
      setIsLoading(false);
    });
    const unsubBuildings = subscribeToTable('buildings', (data) => {
      setBuildings(data.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    });
    const unsubAnnouncements = subscribeToTable('announcements', (data) => {
      setAnnouncements(
        data.filter(a => a.active).sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        )
      );
    });

    return () => {
      unsubContacts();
      unsubBuildings();
      unsubAnnouncements();
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Group contacts by category
  const groupedContacts = contacts.reduce((acc, contact) => {
    const category = contact.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(contact);
    return acc;
  }, {});

  const handleCall = (phone) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`tel:${phone}`);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Render Contacts Tab
  const renderContacts = () => (
    <ScrollView
      className="flex-1 px-4 pt-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#B22222']} tintColor="#B22222" />}
    >
      {isLoading ? (
        <ContactListSkeleton count={5} />
      ) : Object.keys(groupedContacts).length === 0 ? (
        <View className="flex-1 items-center justify-center py-16">
          <IconCircle name="phone" size={32} color={colors.textSecondary} bgColor={colors.surface} circleSize={72} />
          <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 16 }}>No emergency contacts available</Text>
        </View>
      ) : (
        Object.entries(groupedContacts).map(([category, categoryContacts], catIndex) => (
          <View key={category} className="mb-3">
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingHorizontal: 4 }}>
              {category}
            </Text>
            {categoryContacts.map((contact, index) => (
              <AnimatedListItem
                key={contact.id}
                index={catIndex * 3 + index}
                onPress={() => handleCall(contact.phone)}
                style={{ padding: 0, marginBottom: 8, overflow: 'hidden' }}
              >
                <View className="flex-row items-center">
                  <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: '#DCFCE7', margin: 12, alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="phone-call" size={22} color="#16A34A" />
                  </View>
                  <View className="flex-1 py-3 pr-3">
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 }}>
                      {contact.name}
                    </Text>
                    <Text className="text-sm text-red-600 font-medium">
                      {contact.phone}
                    </Text>
                  </View>
                  <View className="pr-4">
                    <Icon name="chevron-right" size={20} color="#D1D5DB" />
                  </View>
                </View>
              </AnimatedListItem>
            ))}
          </View>
        ))
      )}
      <View className="h-28" />
    </ScrollView>
  );

  // Render Buildings Tab
  const renderBuildings = () => (
    <FlatList
      data={buildings}
      keyExtractor={(item) => item.id}
      className="flex-1"
      contentContainerStyle={{ padding: 16, paddingBottom: 112 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View className="flex-1 items-center justify-center py-16">
          <IconCircle name="building" size={32} color={colors.textSecondary} bgColor={colors.surface} circleSize={72} />
          <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 16 }}>No buildings available</Text>
        </View>
      }
      renderItem={({ item, index }) => (
        <AnimatedListItem
          index={index}
          onPress={() => navigation.navigate('BuildingInfo', { building: item })}
          style={{ padding: 0, marginBottom: 12, overflow: 'hidden' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10 }}>
            {item.images && item.images.length > 0 ? (
              <ImageWithGhost 
                uri={item.images[0]} 
                style={{ width: 56, height: 56, borderRadius: 12, marginRight: 12, backgroundColor: '#F3F4F6' }}
              />
            ) : (
              <View style={{ width: 56, height: 56, borderRadius: 12, marginRight: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="building" size={24} color={colors.textSecondary} />
              </View>
            )}
            <View style={{ flex: 1, paddingVertical: 3, paddingRight: 3 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 }}>
                {item.name}
              </Text>
              {item.description && (
                <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              {item.rooms && item.rooms.length > 0 && (
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8, fontWeight: '500' }}>
                  {item.rooms.length} rooms/facilities
                </Text>
              )}
            </View>
            <View style={{ paddingRight: 4 }}>
              <Icon name="chevron-right" size={20} color="#D1D5DB" />
            </View>
          </View>
        </AnimatedListItem>
      )}
    />
  );

  // Render Announcements Tab
  const renderAnnouncements = () => (
    <FlatList
      data={announcements}
      keyExtractor={(item) => item.id}
      className="flex-1"
      contentContainerStyle={{ padding: 16, paddingBottom: 112 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View className="flex-1 items-center justify-center py-16">
          <IconCircle name="megaphone" size={32} color={colors.textSecondary} bgColor={colors.surface} circleSize={72} />
          <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 16 }}>No announcements available</Text>
        </View>
      }
      renderItem={({ item, index }) => (
        <AnimatedListItem
          index={index}
          style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}
        >
          {(item.imageUrl || item.image_url) && (
            <ImageWithGhost 
              uri={item.imageUrl || item.image_url} 
              style={{ width: '100%', height: 288 }}
              resizeMode="cover"
            />
          )}
          <View className="p-4">
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 }}>
              {item.title}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 24, marginBottom: 12 }}>
              {item.body}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              Posted {formatDate(item.created_at)}
            </Text>
          </View>
        </AnimatedListItem>
      )}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* White Header */}
      <SafeHeader title="Campus Info" colors={colors} />

      {/* iOS Segmented Control */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', backgroundColor: isDark ? colors.surface : '#E5E7EB', borderRadius: 10, padding: 3 }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 8,
                  alignItems: 'center',
                  backgroundColor: isActive ? colors.card : 'transparent',
                  ...(isActive ? {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.06,
                    shadowRadius: 2,
                    elevation: 1,
                    ...(isDark ? { borderWidth: 1, borderColor: colors.border } : {}),
                  } : {}),
                }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(tab);
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  fontSize: 13,
                  fontWeight: isActive ? '600' : '500',
                  fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_500Medium',
                  color: isActive ? colors.textPrimary : colors.textSecondary,
                }}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Tab Content */}
      <View className="flex-1">
        {activeTab === 'Contacts' && renderContacts()}
        {activeTab === 'Buildings' && renderBuildings()}
        {activeTab === 'Announcements' && renderAnnouncements()}
      </View>
    </View>
  );
};

export default InfoScreen;
