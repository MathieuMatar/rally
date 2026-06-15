# Béatitudes Ados Rally — Team App

## Local media capture (M7)

The **Photos & video** screen (linked from the Challenge screen) lets a team take photos and
short muted videos for the current station. Captures are saved to the app's private storage and
indexed in the local `captures` table, tagged by `station_id` and timestamp.

**Nothing is uploaded or referenced to the server.** No network call ever carries media — only
the small `outbox` sync events (scans, exits, alerts, etc.) are sent to `/sync`.

### On-device folder layout

```
<app document directory>/RallyMedia/<teamId>/<stationId>/<timestamp>.<ext>
```

`<ext>` is `jpg` for photos and `mp4` for muted videos.

### End-of-day export

To copy all captured media off a phone after the event, with the device connected over USB and
[adb](https://developer.android.com/tools/adb) available:

```sh
# List connected devices
adb devices

# Find the app's document directory for this package
adb shell run-as com.beatitudesados.rally ls files/RallyMedia

# Pull the whole RallyMedia folder to your computer
adb exec-out run-as com.beatitudesados.rally tar c files/RallyMedia | tar x -C ./rally-media-<teamId>
```

Repeat for each team's phone. The result is a `rally-media-<teamId>/RallyMedia/<teamId>/...`
folder per team, organized by station, ready to back up or share.
