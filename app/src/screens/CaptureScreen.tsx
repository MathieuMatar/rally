import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { CameraView, useCameraPermissions, type CameraMode } from 'expo-camera';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { captureDestination, deleteCaptureFile, saveCapture } from '../core/captureStorage';
import { generateUuid } from '../core/uuid';
import { deleteCapture, listCapturesByStation, recordCapture, type CaptureRecord } from '../db/captures';
import type { GameStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';

const MAX_VIDEO_DURATION_SEC = 30;

export function CaptureScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<GameStackParamList, 'Capture'>>();
  const { team, currentStation } = useApp();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<CameraMode>('picture');
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [captures, setCaptures] = useState<CaptureRecord[]>([]);

  useEffect(() => {
    if (currentStation) {
      setCaptures(listCapturesByStation(currentStation.id));
    }
  }, [currentStation]);

  const handleTakePhoto = useCallback(async () => {
    if (!team || !currentStation || !cameraReady) return;
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
    if (!photo) return;

    const createdAt = Date.now();
    const dest = captureDestination(team.id, currentStation.id, 'photo', createdAt);
    await saveCapture(photo.uri, dest);

    const id = generateUuid();
    recordCapture(id, currentStation.id, 'photo', dest, createdAt);
    setCaptures((prev) => [...prev, { id, stationId: currentStation.id, type: 'photo', localPath: dest, createdAt }]);
  }, [team, currentStation, cameraReady]);

  const handleRecordPress = useCallback(async () => {
    if (!team || !currentStation || !cameraReady) return;

    if (recording) {
      cameraRef.current?.stopRecording();
      return;
    }

    setRecording(true);
    const video = await cameraRef.current?.recordAsync({ maxDuration: MAX_VIDEO_DURATION_SEC });
    setRecording(false);
    if (!video) return;

    const createdAt = Date.now();
    const dest = captureDestination(team.id, currentStation.id, 'video', createdAt);
    await saveCapture(video.uri, dest);

    const id = generateUuid();
    recordCapture(id, currentStation.id, 'video', dest, createdAt);
    setCaptures((prev) => [...prev, { id, stationId: currentStation.id, type: 'video', localPath: dest, createdAt }]);
  }, [team, currentStation, cameraReady, recording]);

  const handleRetake = useCallback(async (capture: CaptureRecord) => {
    await deleteCaptureFile(capture.localPath);
    deleteCapture(capture.id);
    setCaptures((prev) => prev.filter((c) => c.id !== capture.id));
  }, []);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>We need camera access to capture photos and videos.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant camera access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.headerLink}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{currentStation?.name ?? 'Capture'}</Text>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'picture' && styles.modeButtonActive]}
            onPress={() => setMode('picture')}
          >
            <Text style={styles.modeButtonText}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'video' && styles.modeButtonActive]}
            onPress={() => setMode('video')}
          >
            <Text style={styles.modeButtonText}>Video</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* DECISION: vision-camera (per spec) needs a native build step we can't add/test here;
          expo-camera's CameraView (already used for QR scanning) covers photo + short, muted
          video capture without extra native config. `mute` avoids requesting microphone access. */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        mode={mode}
        mute
        onCameraReady={() => setCameraReady(true)}
      />

      <TouchableOpacity
        style={[styles.shutter, mode === 'video' && recording ? styles.shutterRecording : null]}
        onPress={mode === 'picture' ? handleTakePhoto : handleRecordPress}
        disabled={!cameraReady}
      >
        <Text style={styles.shutterText}>
          {mode === 'picture' ? 'Take photo' : recording ? 'Stop' : 'Record'}
        </Text>
      </TouchableOpacity>

      {captures.length > 0 ? (
        <ScrollView horizontal style={styles.gallery} contentContainerStyle={styles.galleryContent}>
          {captures.map((capture) => (
            <View key={capture.id} style={styles.thumbWrap}>
              {capture.type === 'photo' ? (
                <Image source={{ uri: capture.localPath }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.videoThumb]}>
                  <Text style={styles.videoThumbText}>Video</Text>
                </View>
              )}
              <TouchableOpacity style={styles.retake} onPress={() => handleRetake(capture)}>
                <Text style={styles.retakeText}>Retake</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1B2D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  headerLink: {
    color: '#3D7BFF',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#16263D',
    borderRadius: 8,
    overflow: 'hidden',
  },
  modeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  modeButtonActive: {
    backgroundColor: '#3D7BFF',
  },
  modeButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  shutter: {
    margin: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#3D7BFF',
  },
  shutterRecording: {
    backgroundColor: '#FF6B6B',
  },
  shutterText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  gallery: {
    maxHeight: 96,
    marginBottom: 16,
  },
  galleryContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  thumbWrap: {
    alignItems: 'center',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#16263D',
  },
  videoThumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoThumbText: {
    color: '#9FB3C8',
    fontSize: 12,
  },
  retake: {
    marginTop: 4,
  },
  retakeText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
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
    alignSelf: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
