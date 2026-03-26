import * as Haptics from 'expo-haptics';

async function run(fn) {
  try {
    await fn();
  } catch {
    // no-op: haptics can fail silently on unsupported devices
  }
}

export function hapticTap() {
  return run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function hapticToggle() {
  return run(() => Haptics.selectionAsync());
}

export function hapticSuccess() {
  return run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

