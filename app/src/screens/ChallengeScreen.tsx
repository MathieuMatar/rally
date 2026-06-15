import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { formatDuration } from '../core/countdown';
import { useNow } from '../hooks/useNow';
import { getStationInstructions } from '../content/stationInstructions';
import type { GameStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';

export function ChallengeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<GameStackParamList, 'Challenge'>>();
  const { currentStation, stationStartedAt } = useApp();
  const now = useNow();

  const elapsedMs = stationStartedAt != null ? Math.max(0, now - stationStartedAt) : 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.contactLink} onPress={() => navigation.navigate('Contact')}>
        <Text style={styles.contactLinkText}>Contact HQ</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.captureLink} onPress={() => navigation.navigate('Capture')}>
        <Text style={styles.captureLinkText}>Photos &amp; video</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Station</Text>
      <Text style={styles.stationName}>{currentStation?.name}</Text>

      <Text style={styles.timer}>{formatDuration(elapsedMs)}</Text>

      <Text style={styles.instructions}>{currentStation ? getStationInstructions(currentStation.id) : ''}</Text>

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Scan', { mode: 'END' })}>
        <Text style={styles.buttonText}>Scan to finish</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#0F1B2D',
  },
  contactLink: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  contactLinkText: {
    color: '#3D7BFF',
    fontSize: 14,
    fontWeight: '600',
  },
  captureLink: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  captureLinkText: {
    color: '#3D7BFF',
    fontSize: 14,
    fontWeight: '600',
  },
  label: {
    color: '#9FB3C8',
    fontSize: 14,
    marginBottom: 8,
  },
  stationName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  timer: {
    color: '#3D7BFF',
    fontSize: 40,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  instructions: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 26,
    flexGrow: 1,
  },
  button: {
    backgroundColor: '#3D7BFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
