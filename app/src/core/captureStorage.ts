import * as FileSystem from 'expo-file-system/legacy';

export type CaptureKind = 'photo' | 'video';

const MEDIA_ROOT = 'RallyMedia';

function extensionFor(kind: CaptureKind): string {
  return kind === 'photo' ? 'jpg' : 'mp4';
}

/** `RallyMedia/<teamId>/<stationId>/<timestamp>.<ext>` inside the app's document directory (§M7). */
export function captureDestination(teamId: string, stationId: string, kind: CaptureKind, timestamp: number): string {
  return `${FileSystem.documentDirectory}${MEDIA_ROOT}/${teamId}/${stationId}/${timestamp}.${extensionFor(kind)}`;
}

/** Copies a temporary camera file into its permanent RallyMedia location, creating folders as needed. */
export async function saveCapture(sourceUri: string, destUri: string): Promise<void> {
  const dir = destUri.slice(0, destUri.lastIndexOf('/') + 1);
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });
}

export async function deleteCaptureFile(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}
