There is a bug.

When using the app, the session ends when the phone is locked.
It aggressively puts the app to sleep.

Note that this is an Obsidian plugin, not a mobile app.
I wonder what are my options to fix it.

There should be Plugin features exposed on the mobile app in Capacitor by the API.

Look up what are those for Obsidian mobile app, and tell me if it's possible to do a foreground service, that keeps the connection alive.

---

# Research Findings

## The Core Problem

Obsidian mobile runs on Capacitor, which wraps a webview. When the phone is locked or the app goes to background:
- **iOS**: The webview is suspended, WebSocket connections drop
- **Android**: Similar behavior, plus aggressive battery optimization from vendors

**Foreground services are NOT available** to Obsidian plugins. Capacitor's Background Runner only supports periodic bursts of work (max 30 seconds on iOS, 10 minutes on Android), not persistent connections. This is an OS-level limitation, not something plugins can bypass.

## Available Solutions

### Option 1: Screen Wake Lock API (Recommended - Partial Fix)

Use the [Screen Wake Lock API](https://www.w3.org/TR/screen-wake-lock/) to prevent the screen from sleeping while the voice session is active.

**Existing plugin**: [obsidian-wake-lock](https://github.com/blotspot/obsidian-wake-lock) already does this.

**Implementation in Hermes**:
```typescript
// In voiceInterface.ts or App.tsx
let wakeLock: WakeLockSentinel | null = null;

async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Wake Lock acquired');
    } catch (err) {
      console.error('Wake Lock failed:', err);
    }
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}
```

**Limitations**:
- Only keeps screen ON while app is in foreground
- Does NOT help when phone is locked (screen off)
- iOS has partial compatibility issues

#### What happens when user presses lock button?

**The Wake Lock is automatically released** when:
- User presses lock button (screen off)
- User switches to another app
- Tab/window becomes invisible

The `WakeLockSentinel` fires a `release` event when this happens. You can detect it:

```typescript
wakeLock.addEventListener('release', () => {
  console.log('Wake Lock was released - screen locked or app backgrounded');
  // Session will likely drop here
});
```

**Can we detect the lock button specifically?** 
- **No direct API** for "lock button pressed"
- But we CAN detect via `visibilitychange` event → `document.visibilityState === 'hidden'`
- Combined with `wakeLock.released === true`, we know the screen went off

**What Wake Lock CANNOT do:**
- It cannot PREVENT the user from locking the screen
- It only prevents AUTO-sleep (screen timeout)
- Once user manually locks → wake lock is released → WebSocket dies

**Detection pattern:**
```typescript
let wakeLock: WakeLockSentinel | null = null;
let sessionWasActive = false;

wakeLock.addEventListener('release', () => {
  if (sessionWasActive) {
    // User locked screen or switched apps during active session
    // Show "Session interrupted" message when they return
  }
});

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && sessionWasActive) {
    // User came back - try to reconnect
    await requestWakeLock(); // Re-acquire wake lock
    await reconnectSession();
  }
});
```

### Option 2: Audio Keep-Alive (Workaround)

Play silent audio to keep the app "active" in the background. Some apps use this trick.

```typescript
// Create silent audio context
const audioContext = new AudioContext();
const oscillator = audioContext.createOscillator();
oscillator.frequency.value = 0; // Silent
oscillator.connect(audioContext.destination);
oscillator.start();
```

**Limitations**:
- May drain battery
- iOS may still kill it after some time
- Could be rejected by app stores (not applicable for plugins)

### ❌ Option 2b: System Bar Notification with Audio Keep-Alive

**NOT POSSIBLE** for Obsidian plugins.

**Why?**
1. **Obsidian's `Notice` class** is an in-app toast notification only - it does NOT create system notifications
2. **System notifications require native APIs** (Android's NotificationManager, iOS's UNUserNotificationCenter)
3. **Obsidian does not expose these APIs** to plugins - confirmed by the Reminder plugin developer
4. **Capacitor's persistent notification plugin** requires native app modifications, not available to plugins

From the [obsidian-reminder](https://github.com/uphy/obsidian-reminder) plugin docs:
> "System notification in mobile device is not available because Obsidian doesn't provide the feature."

**The only way** to get system notifications from Obsidian is via a **separate companion app** (like [Notifian](https://forum.obsidian.md/t/notifications-for-obsidian-android-app/93886)) that reads your vault externally.

**Bottom line**: Audio keep-alive alone won't help because:
- Without a foreground service notification, Android will still kill the app
- Obsidian plugins cannot create foreground services or system notifications

### Option 3: User Education + Graceful Reconnection

Accept the limitation and handle it gracefully:

1. **Detect disconnection** and show clear UI feedback
2. **Auto-reconnect** when app returns to foreground
3. **Preserve conversation state** so user can continue
4. **Notify user** about mobile limitations in settings/onboarding

```typescript
// In voiceInterface.ts
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // App came back to foreground - attempt reconnect
    if (wasConnected && !isConnected) {
      reconnect();
    }
  }
});
```

### Option 4: Android-Specific Battery Settings

Guide users to disable battery optimization for Obsidian:
- Settings → Apps → Obsidian → Battery → Unrestricted

See [dontkillmyapp.com](https://dontkillmyapp.com) for vendor-specific instructions.

---

# Proposed Implementation

## Phase 1: Quick Wins
1. **Add Wake Lock** when voice session starts (keeps screen on)
2. **Add visibility change listener** to detect background/foreground transitions
3. **Show reconnection UI** when connection drops

## Phase 2: Graceful Degradation
1. **Preserve transcript state** across disconnections
2. **Auto-reconnect** with exponential backoff
3. **Add setting** to warn users about mobile limitations

## Phase 3: Documentation
1. Add mobile usage tips to README
2. Link to battery optimization guides per vendor

---

# Conclusion

**Foreground services are not possible** for Obsidian plugins. The best we can do is:
- Keep screen awake during active sessions (Wake Lock API)
- Handle disconnections gracefully with auto-reconnect
- Educate users about mobile OS limitations