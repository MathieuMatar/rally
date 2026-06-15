import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { GameStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';

/**
 * DECISION: the spec calls for a true Android `ACTION_CALL` intent (dials without opening the
 * dialer). That requires a native module + build config change we can't add or test in this
 * environment, so we use `Linking.openURL('tel:...')` (ACTION_DIAL/VIEW) instead — it opens the
 * phone app with the number pre-filled and still uses the voice network on patchy data. Simplest
 * robust option per the project ground rules.
 */
function callNumber(phone: string): void {
  if (!phone) return;
  void Linking.openURL(`tel:${phone}`);
}

export function ContactScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<GameStackParamList, 'Contact'>>();
  const { event, hintsRemaining, sosAckedAt, requestHelp, sendSos, markExpectingCall } = useApp();
  const [helpRequested, setHelpRequested] = useState(false);
  const [sosSentAt, setSosSentAt] = useState<number | null>(null);

  const handleCallHq = () => {
    markExpectingCall();
    callNumber(event?.hqPhone ?? '');
  };

  const handleCallEmergency = () => {
    markExpectingCall();
    sendSos();
    setSosSentAt(Date.now());
    callNumber(event?.emergencyPhone ?? '');
  };

  const handleStuck = () => {
    requestHelp();
    setHelpRequested(true);
    Alert.alert('Help is on the way', "Radio HQ — they'll grant your hint over the air.");
  };

  const sosAcked = sosSentAt != null && sosAckedAt != null && sosAckedAt >= sosSentAt;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Contact HQ</Text>
      <Text style={styles.hints}>Hints left: {hintsRemaining}</Text>

      <TouchableOpacity style={[styles.button, styles.callButton]} onPress={handleCallHq}>
        <Text style={styles.buttonText}>Call HQ</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.emergencyButton]} onPress={handleCallEmergency}>
        <Text style={styles.buttonText}>Call Emergency</Text>
      </TouchableOpacity>
      {sosSentAt != null ? (
        <Text style={styles.status}>{sosAcked ? 'HQ received your SOS.' : 'Sending SOS to HQ…'}</Text>
      ) : null}

      <TouchableOpacity style={[styles.button, styles.stuckButton]} onPress={handleStuck}>
        <Text style={styles.buttonText}>I&apos;m stuck</Text>
      </TouchableOpacity>
      {helpRequested ? <Text style={styles.status}>Help request sent — radio HQ for your hint.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#0F1B2D',
  },
  back: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backText: {
    color: '#3D7BFF',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  hints: {
    color: '#9FB3C8',
    fontSize: 14,
    marginBottom: 32,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  callButton: {
    backgroundColor: '#3D7BFF',
  },
  emergencyButton: {
    backgroundColor: '#FF6B6B',
  },
  stuckButton: {
    backgroundColor: '#3D5A80',
  },
  buttonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  status: {
    color: '#9FB3C8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 16,
  },
});
