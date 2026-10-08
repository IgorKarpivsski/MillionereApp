import type { PackSlug } from '@fm/shared';
import { useMemo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { packSvg } from './packScenes';
import { packStyleSvg, type PackStyle } from './packStyles';

type Look = 'scenes' | PackStyle;
const LOOKS: Look[] = ['scenes', 'retro', 'neon', 'jersey', 'holo', 'mascot'];

/** Which pack look is live — set on the server (app_config 'packs.style'), so it changes without an app update. */
function usePackLook(): Look {
  const { data } = useQuery({
    queryKey: ['pack-style'],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data: row } = await supabase.from('app_config').select('value').eq('key', 'packs.style').maybeSingle();
      const v = row?.value as string | undefined;
      return LOOKS.includes(v as Look) ? (v as Look) : 'retro';
    },
  });
  return data ?? 'retro';
}

export const PACK_NAMES: Record<PackSlug, string> = {
  bronze: 'חבילת ארד',
  silver: 'חבילת כסף',
  gold: 'חבילת זהב',
  epic: 'חבילה אפית',
  legendary: 'חבילה אגדית',
};

/** A foil pack with an illustrated scene per tier (see ./packArt.ts). Original art. */
export function PackArt({ slug, width = 120 }: { slug: PackSlug; width?: number }) {
  const look = usePackLook();
  const xml = useMemo(
    () => (look === 'scenes' ? packSvg(slug, width, `${slug}${Math.round(width)}`) : packStyleSvg(look, slug, width, `${look}${slug}${Math.round(width)}`)),
    [look, slug, width],
  );
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={PACK_NAMES[slug]} style={{ width, height: width * 1.45 }}>
      <SvgXml xml={xml} width={width} height={width * 1.45} />
    </View>
  );
}
