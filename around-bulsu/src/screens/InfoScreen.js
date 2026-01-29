// src/screens/InfoScreen.js - Campus Information Tab with NativeWind
import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Icon, ContactListSkeleton, BuildingListSkeleton, AnimatedCard, AnimatedListItem } from '../components/ui';
import { supabase, subscribeToTable } from '../supabase';
import * as Haptics from 'expo-haptics';

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

const InfoScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('Contacts');
  const [contacts, setContacts] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#800000']} tintColor="#800000" />}
    >
      {isLoading ? (
        <ContactListSkeleton count={5} />
      ) : Object.keys(groupedContacts).length === 0 ? (
        <View className="flex-1 items-center justify-center py-16">
          <IconCircle name="phone" size={32} color="#9CA3AF" bgColor="#F3F4F6" circleSize={72} />
          <Text className="text-base text-gray-400 mt-4">No emergency contacts available</Text>
        </View>
      ) : (
        Object.entries(groupedContacts).map(([category, categoryContacts], catIndex) => (
          <View key={category} className="mb-3">
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
              {category}
            </Text>
            {categoryContacts.map((contact, index) => (
              <AnimatedCard
                key={contact.id}
                delay={(catIndex * 3 + index) * 50}
                onPress={() => handleCall(contact.phone)}
                style={{ marginBottom: 8, padding: 16, flexDirection: 'row', alignItems: 'center' }}
              >
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900 mb-1">
                    {contact.name}
                  </Text>
                  <Text className="text-sm text-red-600 font-medium">
                    {contact.phone}
                  </Text>
                </View>
                <IconCircle name="phone-call" size={20} color="#16A34A" bgColor="#DCFCE7" circleSize={44} />
              </AnimatedCard>
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
          <IconCircle name="building" size={32} color="#9CA3AF" bgColor="#F3F4F6" circleSize={72} />
          <Text className="text-base text-gray-400 mt-4">No buildings available</Text>
        </View>
      }
      renderItem={({ item, index }) => (
        <AnimatedListItem
          index={index}
          onPress={() => navigation.navigate('BuildingInfo', { building: item })}
          style={{ padding: 0, marginBottom: 12, overflow: 'hidden' }}
        >
          <View className="flex-row items-center">
            {item.images && item.images.length > 0 ? (
              <Image 
                source={{ uri: item.images[0] }} 
                className="w-20 h-20"
              />
            ) : (
              <View className="w-20 h-20 bg-gray-100 items-center justify-center">
                <Icon name="building" size={32} color="#9CA3AF" />
              </View>
            )}
            <View className="flex-1 p-3">
              <Text className="text-base font-semibold text-gray-900 mb-1">
                {item.name}
              </Text>
              {item.description && (
                <Text className="text-sm text-gray-500 leading-5" numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              {item.rooms && item.rooms.length > 0 && (
                <Text className="text-xs text-maroon-800 mt-2 font-medium">
                  {item.rooms.length} rooms/facilities
                </Text>
              )}
            </View>
            <View className="pr-4">
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
          <IconCircle name="megaphone" size={32} color="#9CA3AF" bgColor="#F3F4F6" circleSize={72} />
          <Text className="text-base text-gray-400 mt-4">No announcements available</Text>
        </View>
      }
      renderItem={({ item, index }) => (
        <AnimatedCard
          delay={index * 80}
          style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}
        >
          {(item.imageUrl || item.image_url) && (
            <Image 
              source={{ uri: item.imageUrl || item.image_url }} 
              className="w-full h-72"
              resizeMode="cover"
            />
          )}
          <View className="p-4">
            <Text className="text-lg font-bold text-gray-900 mb-2">
              {item.title}
            </Text>
            <Text className="text-sm text-gray-600 leading-6 mb-3">
              {item.body}
            </Text>
            <Text className="text-xs text-gray-400">
              Posted {formatDate(item.created_at)}
            </Text>
          </View>
        </AnimatedCard>
      )}
    />
  );

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-maroon-800 pt-12 pb-5 px-5">
        <Text className="text-3xl font-bold text-white">
          Campus Info
        </Text>
        <Text className="text-sm text-white/70 mt-1">
          Contacts, buildings & updates
        </Text>
      </View>

      {/* Tab Bar */}
      <View className="flex-row bg-white border-b border-gray-200">
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            className={`flex-1 py-4 items-center border-b-[3px] ${
              activeTab === tab ? 'border-maroon-800' : 'border-transparent'
            }`}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab(tab);
            }}
            activeOpacity={0.7}
          >
            <Text className={`text-sm font-medium ${
              activeTab === tab ? 'text-maroon-800 font-semibold' : 'text-gray-500'
            }`}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
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
