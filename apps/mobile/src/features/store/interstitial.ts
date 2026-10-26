import { create } from 'zustand';
import { useSettingsStore } from '@/features/settings/store';
import { showInterstitialAd } from './ads';

/** A full-screen ad after every Nth finished game, for players without "no ads". */
const EVERY = 3;
/** After this many ads, offer "remove ads" again. */
const UPSELL_EVERY = 2;

interface State {
  games: number;
  ads: number;
  upsell: boolean;
  hideUpsell: () => void;
}

export const useInterstitial = create<State>((set) => ({
  games: 0,
  ads: 0,
  upsell: false,
  hideUpsell: () => set({ upsell: false }),
}));

/** Call once when a game's results appear. Shows an ad when it's due. */
export async function gameFinished(adFree: boolean): Promise<void> {
  if (adFree) return;
  // No full-screen ads for children under 13 (or before the age question): only ads they choose to watch.
  const band = useSettingsStore.getState().ageBand;
  if (band === null || band === 'under13') return;
  const st = useInterstitial.getState();
  const games = st.games + 1;
  useInterstitial.setState({ games });
  if (games % EVERY !== 0) return;
  const shown = await showInterstitialAd();
  if (!shown) return;
  const ads = useInterstitial.getState().ads + 1;
  useInterstitial.setState({ ads, upsell: ads % UPSELL_EVERY === 1 });
}
