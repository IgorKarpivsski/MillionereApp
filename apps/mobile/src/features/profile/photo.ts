import type { MyState } from '@fm/shared';
import { MyStateSchema } from '@fm/shared';
import type { Session } from '@supabase/supabase-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import { rpc } from './api';

/** The player's Google account picture, if they signed in with Google. */
export function googlePhotoUrl(session: Session | null): string | null {
  if (!session) return null;
  const fromIdentity = session.user.identities?.find((i) => i.provider === 'google')?.identity_data as
    | { avatar_url?: string; picture?: string }
    | undefined;
  const meta = session.user.user_metadata as { avatar_url?: string; picture?: string } | undefined;
  const url = fromIdentity?.avatar_url ?? fromIdentity?.picture ?? meta?.avatar_url ?? meta?.picture ?? null;
  if (!url || !/^https:\/\/lh\d\.googleusercontent\.com\//.test(url)) return null;
  // ask Google for a bigger square than the default 96 px
  return url.replace(/=s\d+(-c)?$/, '=s256-c');
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Opens the system photo picker, crops to a square, shrinks and uploads. Returns the public URL, or null if cancelled. */
export async function pickAndUploadPhoto(userId: string): Promise<string | null> {
  const res = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (res.canceled || !res.assets[0]) return null;
  const small = await manipulateAsync(res.assets[0].uri, [{ resize: { width: 384, height: 384 } }], {
    compress: 0.8,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!small.base64) throw new Error('no image data');
  const path = `${userId}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, base64ToBytes(small.base64), {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export function useSetPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string | null) => rpc('set_profile_photo', { p_url: url }, (x) => MyStateSchema.parse(x)),
    onSuccess: (state: MyState) => qc.setQueryData(queryKeys.myState, state),
  });
}
