import type { Glyph } from '@fm/shared';
import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg';

/** One slot a matchstick can lie in, in board coordinates. */
interface SlotGeom {
  gi: number;
  si: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vertical: boolean;
}

const DIGIT_W = 64;
const SIGN_W = 50;
const EQ_W = 46;
const GAP = 12;
const H = 112;
const T = 10; // stick thickness
const L = 44; // stick length

function digitSlots(x0: number): Omit<SlotGeom, 'gi' | 'si'>[] {
  const left = x0 + 4, right = x0 + DIGIT_W - 4 - T, top = 4, mid = H / 2 - T / 2, bottom = H - 4 - T;
  const hx = x0 + (DIGIT_W - L) / 2;
  return [
    { x: hx, y: top, w: L, h: T, vertical: false }, // a
    { x: right, y: top + T - 2, w: T, h: L, vertical: true }, // b
    { x: right, y: mid + T - 2, w: T, h: L, vertical: true }, // c
    { x: hx, y: bottom, w: L, h: T, vertical: false }, // d
    { x: left, y: mid + T - 2, w: T, h: L, vertical: true }, // e
    { x: left, y: top + T - 2, w: T, h: L, vertical: true }, // f
    { x: hx, y: mid, w: L, h: T, vertical: false }, // g
  ];
}

function signSlots(x0: number): Omit<SlotGeom, 'gi' | 'si'>[] {
  return [
    { x: x0 + (SIGN_W - L) / 2, y: H / 2 - T / 2, w: L, h: T, vertical: false },
    { x: x0 + SIGN_W / 2 - T / 2, y: H / 2 - L / 2, w: T, h: L, vertical: true },
  ];
}

export function boardLayout(glyphs: Glyph[]) {
  const slots: SlotGeom[] = [];
  const eqs: number[] = [];
  let x = 0;
  glyphs.forEach((g, gi) => {
    if (g.kind === 'digit') {
      digitSlots(x).forEach((s, si) => slots.push({ ...s, gi, si }));
      x += DIGIT_W;
    } else if (g.kind === 'sign') {
      signSlots(x).forEach((s, si) => slots.push({ ...s, gi, si }));
      x += SIGN_W;
    } else {
      eqs.push(x);
      x += EQ_W;
    }
    x += GAP;
  });
  return { slots, eqs, width: x - GAP, height: H };
}

function Stick({ x, y, w, h, vertical, color, lifted }: { x: number; y: number; w: number; h: number; vertical: boolean; color: string; lifted?: boolean }) {
  const r = T / 2;
  const headR = T * 0.72;
  const hx = vertical ? x + w / 2 : x + w - headR + 1;
  const hy = vertical ? y + headR - 1 : y + h / 2;
  return (
    <G opacity={lifted ? 0.35 : 1}>
      <Rect x={x + 1} y={y + 2} width={w} height={h} rx={r} fill="rgba(0,0,0,0.25)" />
      <Rect x={x} y={y} width={w} height={h} rx={r} fill={color} stroke="#8A5A2B" strokeWidth={1.2} />
      <Circle cx={hx} cy={hy} r={headR} fill="#E5392B" stroke="#8E1C14" strokeWidth={1.2} />
      <Circle cx={hx - 1.5} cy={hy - 1.5} r={headR * 0.35} fill="rgba(255,255,255,0.55)" />
    </G>
  );
}

/**
 * The matchstick equation. `placeable` shows dashed outlines on empty slots,
 * `selectable` makes lit sticks tappable. `marked` = sticks the player moved.
 */
export const MatchBoard = memo(function MatchBoard({
  glyphs,
  width,
  placeable,
  selectable,
  onSlot,
  highlight,
}: {
  glyphs: Glyph[];
  width: number;
  placeable: boolean;
  selectable: boolean;
  onSlot: (gi: number, si: number, filled: boolean) => void;
  highlight?: 'good' | 'bad' | null;
}) {
  const { slots, eqs, width: bw, height: bh } = boardLayout(glyphs);
  const pad = 10;
  const scale = Math.min(width / (bw + pad * 2), 1.6);
  const vw = bw + pad * 2, vh = bh + pad * 2;
  const stickColor = highlight === 'good' ? '#F7D774' : 'url(#wood)';
  return (
    <View style={{ width: vw * scale, height: vh * scale }}>
      <Svg width={vw * scale} height={vh * scale} viewBox={`${-pad} ${-pad} ${vw} ${vh}`}>
        <Defs>
          <LinearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F3D29A" />
            <Stop offset="1" stopColor="#D9A75E" />
          </LinearGradient>
        </Defs>
        {eqs.map((x) => (
          <G key={`eq${x}`}>
            <Stick x={x + (EQ_W - 36) / 2} y={H / 2 - 16} w={36} h={T} vertical={false} color="url(#wood)" />
            <Stick x={x + (EQ_W - 36) / 2} y={H / 2 + 6} w={36} h={T} vertical={false} color="url(#wood)" />
          </G>
        ))}
        {slots.map((s) => {
          const g = glyphs[s.gi]!;
          const filled = g.kind !== 'eq' && Boolean(g.mask & (1 << s.si));
          const active = filled ? selectable : placeable;
          return (
            <G key={`${s.gi}-${s.si}`}>
              {filled ? (
                <Stick {...s} color={highlight === 'bad' ? '#E8A07E' : stickColor} />
              ) : placeable ? (
                <Rect x={s.x} y={s.y} width={s.w} height={s.h} rx={T / 2} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.45)" strokeWidth={1.4} strokeDasharray="4 4" />
              ) : null}
              {active ? (
                <Rect
                  x={s.x - (s.vertical ? 8 : 2)}
                  y={s.y - (s.vertical ? 2 : 8)}
                  width={s.w + (s.vertical ? 16 : 4)}
                  height={s.h + (s.vertical ? 4 : 16)}
                  fill="transparent"
                  onPress={() => onSlot(s.gi, s.si, filled)}
                />
              ) : null}
            </G>
          );
        })}
      </Svg>
    </View>
  );
});
