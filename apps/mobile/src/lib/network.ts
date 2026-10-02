import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
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
