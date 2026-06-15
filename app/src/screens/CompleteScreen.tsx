import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';

export function CompleteScreen() {
  const { team, score } = useApp();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Route complete!</Text>
      <Text style={styles.message}>
        Great work, {team?.name ?? 'team'}! Head back to HQ for the final treasure.
      </Text>
      <Text style={styles.score}>Score: {score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0F1B2D',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    color: '#9FB3C8',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
  },
  score: {
    color: '#3D7BFF',
    fontSize: 24,
    fontWeight: '700',
  },
});
