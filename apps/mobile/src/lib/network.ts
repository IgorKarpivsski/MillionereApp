import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { useEffect, useState } from 'react';

/** Keeps React Query's online state in sync, so queries pause offline. */
export function bindOnlineManager(): () => void {
  return NetInfo.addEventListener((state) => {
    onlineManager.setOnline(state.isConnected !== false && state.isInternetReachable !== false);
  });
}

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => onlineManager.subscribe(setOnline), []);
  return online;
}

/**
 * Tells React Query when the app is in the foreground: polling (chat, presence) stops in the
 * background and data refreshes when the player comes back.
 */
export function bindFocusManager(): () => void {
  const sub = AppState.addEventListener('change', (st) => focusManager.setFocused(st === 'active'));
  return () => sub.remove();
}
