import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { BroadcastMessage } from '@rally/shared';

interface BroadcastBannerProps {
  broadcasts: BroadcastMessage[];
}

/** Shows the latest organizer broadcast (§M8) until the team dismisses it. */
export function BroadcastBanner({ broadcasts }: BroadcastBannerProps) {
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const latest = broadcasts.length > 0 ? broadcasts[broadcasts.length - 1] : null;

  if (!latest || latest.at === dismissedAt) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{latest.message}</Text>
      <TouchableOpacity onPress={() => setDismissedAt(latest.at)}>
        <Text style={styles.dismiss}>Dismiss</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#1B3D2C',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  text: {
    color: '#9FE3B0',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  dismiss: {
    color: '#3D7BFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
