let audioContext: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;

const getAudioContextClass = (): typeof AudioContext | null => {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || null;
};

export function startSilentAudio(): boolean {
  if (audioContext) return true;

  try {
    const AudioContextClass = getAudioContextClass();
    if (!AudioContextClass) return false;

    audioContext = new AudioContextClass();
    oscillator = audioContext.createOscillator();
    gainNode = audioContext.createGain();
    gainNode.gain.value = 0;

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    return true;
  } catch (err) {
    console.error('Silent audio failed:', err);
    return false;
  }
}

export function stopSilentAudio(): void {
  if (oscillator) {
    try {
      oscillator.stop();
    } catch (err) {
      console.error('Silent audio stop failed:', err);
    }
    oscillator.disconnect();
    oscillator = null;
  }

  if (gainNode) {
    gainNode.disconnect();
    gainNode = null;
  }

  if (audioContext) {
    void audioContext.close();
    audioContext = null;
  }
}
