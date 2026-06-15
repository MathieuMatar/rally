import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ChallengeScreen } from '../screens/ChallengeScreen';
import { ClueScreen } from '../screens/ClueScreen';
import { CompleteScreen } from '../screens/CompleteScreen';
import { ContactScreen } from '../screens/ContactScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MapScreen } from '../screens/MapScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { useApp } from '../state/AppContext';
import type { AuthStackParamList, GameStackParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const GameStack = createNativeStackNavigator<GameStackParamList>();

function LoadingScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1B2D' }}>
      <ActivityIndicator color="#3D7BFF" size="large" />
    </View>
  );
}

export function RootNavigator() {
  const { status, finished, stationStartedAt } = useApp();

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  const initialRouteName: keyof GameStackParamList = finished
    ? 'Complete'
    : stationStartedAt != null
      ? 'Challenge'
      : 'Clue';

  return (
    <NavigationContainer>
      {status === 'logged_out' ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
        </AuthStack.Navigator>
      ) : (
        <GameStack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
          <GameStack.Screen name="Clue" component={ClueScreen} />
          <GameStack.Screen name="Scan" component={ScanScreen} />
          <GameStack.Screen name="Challenge" component={ChallengeScreen} />
          <GameStack.Screen name="Complete" component={CompleteScreen} />
          <GameStack.Screen name="Map" component={MapScreen} />
          <GameStack.Screen name="Contact" component={ContactScreen} />
        </GameStack.Navigator>
      )}
    </NavigationContainer>
  );
}
