type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
};

type WakeLockController = {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>;
};

const getWakeLockController = (): WakeLockController | null => {
  const controller = (navigator as Navigator & { wakeLock?: WakeLockController }).wakeLock;
  return controller || null;
};

let wakeLock: WakeLockSentinelLike | null = null;
let releaseHandler: (() => void) | null = null;

const isSupported = (): boolean => {
  return typeof navigator !== 'undefined' && getWakeLockController() !== null;
};

const handleRelease = () => {
  wakeLock = null;
  if (releaseHandler) {
    releaseHandler();
  }
};

export async function requestWakeLock(onRelease?: () => void): Promise<boolean> {
  if (!isSupported()) {
    return false;
  }

  if (onRelease) {
    releaseHandler = onRelease;
  }

  try {
    if (wakeLock && !wakeLock.released) {
      return true;
    }

    const controller = getWakeLockController();
    if (!controller) return false;
    wakeLock = await controller.request('screen');
    wakeLock.addEventListener('release', handleRelease);
    return true;
  } catch (err) {
    console.error('Wake Lock request failed:', err);
    return false;
  }
}

export function releaseWakeLock(): void {
  if (wakeLock) {
    try {
      wakeLock.release();
    } catch (err) {
      console.error('Wake Lock release failed:', err);
    }
  }
  wakeLock = null;
}

export function clearWakeLockReleaseHandler(): void {
  releaseHandler = null;
}

export function isWakeLockActive(): boolean {
  return wakeLock !== null && !wakeLock.released;
}
