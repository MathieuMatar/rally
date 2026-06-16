import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { buildMapHtml, type MapCommand, type MapHostMessage, type MapStationInput } from '@rally/shared';
import { getCompletedCount } from '../db/progress';
import { loadRoute } from '../db/route';
import { getSetting } from '../db/settings';
import type { GameStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';

/**
 * Shows the team's own trail of visited stations plus a live GPS dot.
 * DECISION: stations not yet visited are never sent to the map, so the team can't
 * use this screen to scout ahead.
 */
export function MapScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<GameStackParamList, 'Map'>>();
  const { team } = useApp();
  const webviewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  // Pre-downloaded tiles are served by our own backend (§M9), so the map still renders
  // Gharzouz with no internet access once they're cached by the WebView.
  const mapHtml = useMemo(() => {
    const serverUrl = getSetting('server_url');
    return buildMapHtml(serverUrl ? { localTileUrl: `${serverUrl}/tiles` } : {});
  }, []);

  function post(command: MapCommand) {
    webviewRef.current?.postMessage(JSON.stringify(command));
  }

  useEffect(() => {
    if (!ready) return;

    const route = loadRoute();
    const visited = route.slice(0, getCompletedCount());
    const stations: MapStationInput[] = visited.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      lat: s.lat,
      lng: s.lng,
    }));

    post({ type: 'init', stations });
    post({ type: 'trail', stationIds: visited.map((s) => s.id), color: team?.color ?? '#3D7BFF' });
  }, [ready, team]);

  const gpsPositionsRef = useRef<{ lat: number; lng: number }[]>([]);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    gpsPositionsRef.current = [];

    void (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5_000, distanceInterval: 5 },
        (location) => {
          const pos = { lat: location.coords.latitude, lng: location.coords.longitude };
          gpsPositionsRef.current = [...gpsPositionsRef.current, pos];
          post({
            type: 'gpsTrail',
            positions: gpsPositionsRef.current,
            color: team?.color ?? '#3D7BFF',
          });
          post({
            type: 'pins',
            pins: [
              {
                id: team?.id ?? 'me',
                lat: pos.lat,
                lng: pos.lng,
                color: team?.color ?? '#3D7BFF',
                label: 'You',
              },
            ],
          });
        },
      );
    })();

    return () => {
      subscription?.remove();
      gpsPositionsRef.current = [];
    };
  }, [team]);

  function onMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data) as MapHostMessage;
      if (data.type === 'ready') setReady(true);
    } catch {
      // Ignore malformed messages from the map page.
    }
  }

  return (
    <View style={styles.container}>
      <WebView ref={webviewRef} source={{ html: mapHtml }} onMessage={onMessage} style={styles.webview} />
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1B2D',
  },
  webview: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#16263D',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
