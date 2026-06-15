import * as Location from 'expo-location';
import { AppState, type AppStateStatus } from 'react-native';

const TIME_INTERVAL_MS = 15_000;
const DISTANCE_INTERVAL_M = 15;

/**
 * Watches the device's foreground GPS position at a low frequency and reports
 * updates so organizers can see the team on the live map (§3.3). Tracking pauses
 * automatically when the app is backgrounded.
 *
 * DECISION: background location tracking (expo-task-manager) is out of scope for
 * this milestone — only foreground updates are sent.
 */
export class LocationTracker {
  private subscription: Location.LocationSubscription | null = null;
  private appStateSubscription: { remove(): void } | null = null;

  constructor(private readonly onLocation: (lat: number, lng: number) => void) {}

  async start(): Promise<void> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    if (AppState.currentState === 'active') {
      await this.watch();
    }
  }

  stop(): void {
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    this.unwatch();
  }

  private handleAppStateChange = (state: AppStateStatus): void => {
    if (state === 'active') {
      void this.watch();
    } else {
      this.unwatch();
    }
  };

  private async watch(): Promise<void> {
    if (this.subscription) return;
    this.subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: TIME_INTERVAL_MS, distanceInterval: DISTANCE_INTERVAL_M },
      (location) => {
        this.onLocation(location.coords.latitude, location.coords.longitude);
      },
    );
  }

  private unwatch(): void {
    this.subscription?.remove();
    this.subscription = null;
  }
}
