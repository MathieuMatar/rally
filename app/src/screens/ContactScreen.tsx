import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { GameStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';

export function ContactScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<GameStackParamList, 'Contact'>>();
  const {
    hintsRemaining, sosAckedAt,
    callState, callType, callMuted,
    requestHelp, sendSos,
    startCall, endCall, toggleMute,
  } = useApp();
  const [helpRequested, setHelpRequested] = useState(false);
  const [sosSentAt, setSosSentAt] = useState<number | null>(null);

  const handleCallHq = () => {
    startCall('hq').catch(() => {
      Alert.alert('Could not start call', 'Microphone permission is required. Please allow it in Settings.');
    });
  };

  const handleCallEmergency = () => {
    setSosSentAt(Date.now());
    startCall('emergency').catch(() => {
      Alert.alert('Could not start call', 'Microphone permission is required. Please allow it in Settings.');
    });
  };

  const handleStuck = () => {
    requestHelp();
    setHelpRequested(true);
    Alert.alert('Help is on the way', "Radio HQ — they'll grant your hint over the air.");
  };

  const sosAcked = sosSentAt != null && sosAckedAt != null && sosAckedAt >= sosSentAt;

  // ── In-call screen ──────────────────────────────────────────────────────────
  if (callState === 'dialing' || callState === 'connected') {
    const label = callType === 'emergency' ? 'Emergency' : 'HQ';
    return (
      <View style={styles.container}>
        <Text style={styles.callStatus}>
          {callState === 'dialing' ? `Calling ${label}…` : `In call with ${label}`}
        </Text>
        {callState === 'connected' && (
          <Text style={styles.callConnected}>Connected</Text>
        )}
        <View style={styles.callControls}>
          <TouchableOpacity
            style={[styles.callControlBtn, callMuted && styles.callControlBtnActive]}
            onPress={toggleMute}
          >
            <Text style={styles.callControlText}>{callMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.callControlBtn, styles.endCallBtn]} onPress={endCall}>
            <Text style={styles.callControlText}>End Call</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Idle screen ─────────────────────────────────────────────────────────────
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
    justifyContent: 'center',
  },
  back: {
    position: 'absolute',
    top: 24,
    left: 24,
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
  callButton: { backgroundColor: '#3D7BFF' },
  emergencyButton: { backgroundColor: '#FF6B6B' },
  stuckButton: { backgroundColor: '#3D5A80' },
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
  // In-call styles
  callStatus: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  callConnected: {
    color: '#4CAF50',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 48,
  },
  callControls: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    marginTop: 16,
  },
  callControlBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    backgroundColor: '#1C2C42',
  },
  callControlBtnActive: {
    backgroundColor: '#3D5A80',
  },
  endCallBtn: {
    backgroundColor: '#FF6B6B',
  },
  callControlText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
