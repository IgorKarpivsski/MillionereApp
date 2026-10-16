import { router } from 'expo-router';

/** Leaves any game/screen stack and lands on the home tab. */
export function goHome(): void {
  if (router.canDismiss()) router.dismissAll();
  router.navigate('/(tabs)');
}
