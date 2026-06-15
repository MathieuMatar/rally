import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AppProvider } from './src/state/AppContext';

export default function App() {
  return (
    <AppProvider>
      <RootNavigator />
      <StatusBar style="light" />
    </AppProvider>
  );
}
