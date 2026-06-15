import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ScanResult } from '../core/scan';
import type { GameStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';

function describeFailure(reason: Exclude<ScanResult, { ok: true }>['reason']): string {
  switch (reason) {
    case 'malformed':
      return "That doesn't look like a rally QR code. Try again.";
    case 'not_expected':
      return "This isn't your next station. Check the clue and try again.";
    case 'finished':
      return "You've already finished the whole route!";
    default:
      return 'Something went wrong. Try again.';
  }
}

export function ScanScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<GameStackParamList, 'Scan'>>();
  const route = useRoute<RouteProp<GameStackParamList, 'Scan'>>();
  const { mode } = route.params;
  const { scanStart, scanEnd, routeState } = useApp();

  const [permission, requestPermission] = useCameraPermissions();
  const [message, setMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);

  const handleScan = useCallback(
    ({ data }: { data: string }) => {
      if (!scanning) return;
      setScanning(false);

      const result = mode === 'START' ? scanStart(data) : scanEnd(data);

      if (result.ok) {
        if (mode === 'START') {
          navigation.replace('Challenge');
        } else {
          const wasLastStation = routeState ? routeState.currentIndex >= routeState.route.length - 1 : true;
          navigation.reset({ index: 0, routes: [{ name: wasLastStation ? 'Complete' : 'Clue' }] });
        }
        return;
      }

      setMessage(describeFailure(result.reason));
      setTimeout(() => {
        setMessage(null);
        setScanning(true);
      }, 2000);
    },
    [scanning, mode, scanStart, scanEnd, routeState, navigation],
  );

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>We need camera access to scan station QR codes.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant camera access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanning ? handleScan : undefined}
      />
      <View style={styles.overlay}>
        <Text style={styles.instructions}>
          {mode === 'START' ? 'Scan the START code at this station' : 'Scan the END code to finish this station'}
        </Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1B2D',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: 'rgba(15, 27, 45, 0.85)',
  },
  instructions: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  message: {
    color: '#FF6B6B',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 8,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#3D7BFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
