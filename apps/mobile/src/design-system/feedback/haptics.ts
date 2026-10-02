import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useSettingsStore } from '@/features/settings/store';

type Kind = 'tap' | 'select' | 'success' | 'error' | 'heavy';

/** All haptics go through here so the in-app toggle is always respected. */
export function haptic(kind: Kind): void {
  if (Platform.OS === 'web' || !useSettingsStore.getState().haptics) return;
  switch (kind) {
    case 'tap':
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case 'select':
      void Haptics.selectionAsync();
      break;
    case 'heavy':
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      break;
    case 'success':
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case 'error':
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      break;
  }
}
