import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import * as Application from 'expo-application';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useToast } from '@/design-system/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useRefreshEconomy } from '@/features/engage/hooks';
import { strings } from '@/lib/i18n';
import { referralApi, referralKey } from './api';

const KEY = 'ref_install_checked';

/**
 * A friend's invite link carries the code to the Play Store ("referrer=ref=ABC123").
 * On the first run we read it once and claim the welcome gift for the new player.
 */
export function AutoRedeem() {
  const { session } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const refresh = useRefreshEconomy();
  useEffect(() => {
    if (!session || Platform.OS !== 'android') return;
    let cancelled = false;
    void (async () => {
      try {
        if (await AsyncStorage.getItem(KEY)) return;
        await AsyncStorage.setItem(KEY, '1');
        const ref = await Application.getInstallReferrerAsync();
        const code = /ref=([A-Z0-9]{6})/i.exec(decodeURIComponent(ref ?? ''))?.[1];
        if (!code || cancelled) return;
        const s = await referralApi.redeem(code.toUpperCase());
        qc.setQueryData(referralKey, s);
        refresh();
        toast(strings.referral.redeemed, 'success');
      } catch {
        // no referrer, an old account or a bad code: nothing to do
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, toast, qc, refresh]);
  return null;
}
