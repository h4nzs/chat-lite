export const playHaptic = (pattern: number | number[] = 50) => {
  // Cek apakah browser & HP support fitur getar (Haptic Feedback)
  if (typeof window !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (_e) {
      // Ignore vibration errors (e.g. user denied permission or not supported context)
    }
  }
};

export const playSound = (type: 'send' | 'receive' | 'delete') => {
  if (typeof window === 'undefined') return;

  try {
    const audio = new Audio(`/sounds/${type}.mp3`);
    audio.volume = 0.4; // Volume moderat biar elegan
    
    // Play returns a promise which might reject if user hasn't interacted with document yet
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.catch((_error) => {
        // Auto-play was prevented. This is normal browser policy.
        // We can silently ignore this, as sound is an enhancement, not critical.
        // console.log("Audio playback prevented:", error); 
      });
    }
  } catch (e) {
    console.error("Failed to initialize audio:", e);
  }
};

export const triggerSendFeedback = () => {
  playHaptic(30); // Getar sangat pendek & tajam
  playSound('send');
};

export const triggerReceiveFeedback = () => {
  playHaptic([30, 50, 30]); // Pola getar pendek-panjang-pendek
  playSound('receive');
};

/**
 * Log error to console AND attempt Sentry capture (fire-and-forget).
 * Use this instead of .catch(console.error) for better production visibility.
 */
export function captureAndLog(error: unknown, context?: string): void {
  if (context) {
    console.error(`[${context}]`, error);
  } else {
    console.error(error);
  }
  // Fire-and-forget Sentry capture — avoids circular deps with Sentry init
  try {
    import('@sentry/react').then(S => S.captureException(error)).catch(() => {});
  } catch {}
}
