import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface OfflineBannerProps {
  online: boolean;
}

/**
 * Persistent indicator (§M9) shown while the server is unreachable. Progress is still saved
 * locally and queued for `/sync`, so this never blocks the team from continuing the loop.
 */
export function OfflineBanner({ online }: OfflineBannerProps) {
  if (online) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Offline — your progress is saved and will sync once you're back in range.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#3D2F0F',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  text: {
    color: '#FFD27F',
    fontSize: 14,
    fontWeight: '600',
  },
});
