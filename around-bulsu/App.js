import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ARScreen from './src/screens/ARScreen';

import NavigateScreen from './src/screens/MapsScreen';

const EmergencyScreen = () => <View><Text style={{marginTop: 50, textAlign: 'center'}}>Emergency Page</Text></View>;
const InfoScreen = () => <View><Text style={{marginTop: 50, textAlign: 'center'}}>Info Page</Text></View>;

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: { backgroundColor: '#800000' },
            tabBarActiveTintColor: 'white',
            tabBarInactiveTintColor: '#ffcccc',
          }}
        >
          <Tab.Screen name="Navigate" component={NavigateScreen} />
          <Tab.Screen name="Emergency" component={EmergencyScreen} />
          <Tab.Screen name="Info" component={InfoScreen} />
          <Tab.Screen name="AR" component={ARScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}