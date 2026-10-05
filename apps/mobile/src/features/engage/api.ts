import {
  DealsStateSchema,
  EnergyStateSchema,
  PassStateSchema,
  WheelSpinSchema,
  WheelStateSchema,
  type DealsState,
  type EnergyState,
  type PassState,
  type WheelSpin,
  type WheelState,
} from '@fm/shared';
import { requestId } from '@/features/collection/api';
import { rpc } from '@/features/profile/api';

export const engageApi = {
  energy: (): Promise<EnergyState> => rpc('energy_state', undefined, (x) => EnergyStateSchema.parse(x)),
  refill: (how: 'gems' | 'ad'): Promise<EnergyState> =>
    rpc('energy_refill', { p_how: how, p_request: requestId() }, (x) => EnergyStateSchema.parse(x)),
  wheel: (): Promise<WheelState> => rpc('wheel_state', undefined, (x) => WheelStateSchema.parse(x)),
  spin: (pay: 'free' | 'gems', id: string): Promise<WheelSpin> =>
    rpc('wheel_spin', { p_pay: pay, p_request: id }, (x) => WheelSpinSchema.parse(x)),
  deals: (): Promise<DealsState> => rpc('deals_state', undefined, (x) => DealsStateSchema.parse(x)),
  buyDeal: (deal: string, window: number) => rpc('deal_buy', { p_deal: deal, p_window: window }, (x) => x),
  pass: (): Promise<PassState> => rpc('pass_state', undefined, (x) => PassStateSchema.parse(x)),
  claimTier: (tier: number, track: 'free' | 'premium') => rpc('pass_claim', { p_tier: tier, p_track: track }, (x) => x),
  buyPremium: (): Promise<PassState> => rpc('pass_buy_premium', undefined, (x) => PassStateSchema.parse(x)),
};
