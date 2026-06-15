import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatDuration, getCountdown } from '../core/countdown';
import { useNow } from '../hooks/useNow';
import type { GameStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';

export function ClueScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<GameStackParamList, 'Clue'>>();
  const { event, currentStation, crossingCategory, score, hintsRemaining, clueOverride } = useApp();
  const now = useNow();

  const countdown = event?.eventStartIso
    ? getCountdown(event.eventStartIso, event.durationMinutes, now)
    : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Time left</Text>
          <Text style={[styles.statValue, countdown?.isOver && styles.statValueAlert]}>
            {countdown ? formatDuration(countdown.remainingMs) : '--:--'}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Score</Text>
          <Text style={styles.statValue}>{score}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Hints left</Text>
          <Text style={styles.statValue}>{hintsRemaining}</Text>
        </View>
      </View>

      <View style={styles.linkRow}>
        <TouchableOpacity onPress={() => navigation.navigate('Contact')}>
          <Text style={styles.mapLinkText}>Contact HQ</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Map')}>
          <Text style={styles.mapLinkText}>View map</Text>
        </TouchableOpacity>
      </View>

      {crossingCategory ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Long walk to the other area — stay together!</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Your next clue</Text>
      <Text style={styles.stationName}>{currentStation?.name}</Text>
      <Text style={styles.clue}>{clueOverride ?? currentStation?.clue}</Text>

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Scan', { mode: 'START' })}>
        <Text style={styles.buttonText}>Scan to start</Text>
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#9FB3C8',
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  statValueAlert: {
    color: '#FF6B6B',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  mapLinkText: {
    color: '#3D7BFF',
    fontSize: 14,
    fontWeight: '600',
  },
  notice: {
    backgroundColor: '#3D2C1B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  noticeText: {
    color: '#FFD27F',
    textAlign: 'center',
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
  clue: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 28,
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
