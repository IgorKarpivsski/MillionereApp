import { useEffect, useRef } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { rpc } from '@/features/profile/api';
import { useSettingsStore } from './store';

/**
 * Tells the server the age band the player picked (under 13 / 13–15 / 16+), so the
 * game can match it: the easy first games are only for the youngest players.
 * Only the band is sent, never an age or a birth date.
 */
export function AgeBandSync() {
  const { session } = useAuth();
  const band = useSettingsStore((s) => s.ageBand);
  const sent = useRef<string | null>(null);
  const uid = session?.user?.id;
  useEffect(() => {
    if (!uid || !band) return;
    const key = `${uid}:${band}`;
    if (sent.current === key) return;
    sent.current = key;
    rpc('set_age_band', { p_band: band }, () => undefined).catch(() => {
      sent.current = null;
    });
  }, [uid, band]);
  return null;
}
