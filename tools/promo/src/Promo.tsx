import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  OffthreadVideo,
  random,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export const FPS = 30;
export const DURATION = 22 * FPS;

const FONT = '"IBM Plex Sans Hebrew", sans-serif';
const GOLD = '#FFC93C';
const VIOLET = '#B49CFF';
const NIGHT = '#140C33';
const GREEN = '#3DDC84';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function useEnter(delay = 0, damping = 12) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.7 } });
}

/** Big Hebrew headline that pops in. */
function Headline({
  text,
  delay = 0,
  size = 96,
  color = '#FFFFFF',
  top = 220,
  out,
}: {
  text: string;
  delay?: number;
  size?: number;
  color?: string;
  top?: number;
  out?: number;
}) {
  const frame = useCurrentFrame();
  const s = useEnter(delay, 11);
  const fade = out === undefined ? 1 : interpolate(frame, [out, out + 8], [1, 0], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 60,
        right: 60,
        direction: 'rtl',
        textAlign: 'center',
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.15,
        color,
        opacity: s * fade,
        transform: `translateY(${(1 - s) * 60}px) scale(${0.85 + s * 0.15})`,
        textShadow: '0 6px 24px rgba(0,0,0,0.75), 0 0 2px rgba(0,0,0,0.9)',
      }}
    >
      {text}
    </div>
  );
}

/** Soft glowing radial light. */
function Glow({ color, size, x = 540, y = 960, opacity = 1 }: { color: string; size: number; x?: number; y?: number; opacity?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        opacity,
        background: `radial-gradient(circle, ${color}cc 0%, ${color}44 35%, transparent 70%)`,
      }}
    />
  );
}

/** Drifting golden dust over every scene. */
function Dust({ seed, count = 40 }: { seed: string; count?: number }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: count }, (_, i) => {
        const x = random(`${seed}x${i}`) * 1080;
        const speed = 0.6 + random(`${seed}s${i}`) * 1.6;
        const y = (random(`${seed}y${i}`) * 2100 - frame * speed * 3) % 2100;
        const size = 3 + random(`${seed}z${i}`) * 7;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(frame / 12 + i));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y < 0 ? y + 2100 : y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: i % 4 === 0 ? '#FFFFFF' : GOLD,
              opacity: tw * 0.8,
              boxShadow: `0 0 ${size * 2}px ${GOLD}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

/** A ring of light that expands from the center. */
function Shock({ at, color = GOLD, x = 540, y = 960, max = 1400 }: { at: number; color?: string; x?: number; y?: number; max?: number }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 22], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  if (frame < at || p >= 1) return null;
  const size = 80 + p * max;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        border: `${10 * (1 - p) + 2}px solid ${color}`,
        opacity: 1 - p,
        boxShadow: `0 0 40px ${color}, inset 0 0 40px ${color}`,
      }}
    />
  );
}

function Flash({ at, length = 10, strength = 0.9 }: { at: number; length?: number; strength?: number }) {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + 2, at + length], [0, strength, 0], clamp);
  return <AbsoluteFill style={{ background: '#FFFFFF', opacity: o, pointerEvents: 'none' }} />;
}

/** Four-point sparkles bursting from a point. */
function Sparkles({ at, x = 540, y = 960, count = 16, radius = 420, seed = 's' }: { at: number; x?: number; y?: number; count?: number; radius?: number; seed?: string }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 30], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  if (frame < at || p >= 1) return null;
  return (
    <AbsoluteFill>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + random(`${seed}a${i}`) * 0.5;
        const d = radius * (0.5 + random(`${seed}d${i}`) * 0.6) * p;
        const s = (24 + random(`${seed}s${i}`) * 34) * (p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7);
        return (
          <svg
            key={i}
            width={s}
            height={s}
            viewBox="-1 -1 2 2"
            style={{ position: 'absolute', left: x + Math.cos(a) * d - s / 2, top: y + Math.sin(a) * d - s / 2, transform: `rotate(${p * 180}deg)` }}
          >
            <path d="M0 -1 Q0.12 -0.12 1 0 Q0.12 0.12 0 1 Q-0.12 0.12 -1 0 Q-0.12 -0.12 0 -1 Z" fill={i % 3 === 0 ? '#FFFFFF' : GOLD} />
          </svg>
        );
      })}
    </AbsoluteFill>
  );
}

function StageBg({ tint = VIOLET }: { tint?: string }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Img src={staticFile('stage.png')} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1.05 + frame * 0.0006})` }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${tint}22, transparent 40%, ${NIGHT}aa)` }} />
    </AbsoluteFill>
  );
}

function Clip({ src, from = 0, zoom = 0.0008 }: { src: string; from?: number; zoom?: number }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <OffthreadVideo
        src={staticFile(src)}
        startFrom={from}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1.02 + frame * zoom})` }}
      />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* Scenes                                                              */
/* ------------------------------------------------------------------ */

function HookScene() {
  const frame = useCurrentFrame();
  const logo = useEnter(66, 9);
  return (
    <AbsoluteFill>
      <Clip src="hook.mp4" />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(10,4,30,0.75), transparent 35%, transparent 70%, rgba(10,4,30,0.6))' }} />
      <Headline text="חושבים שאתם יודעים הכל?" top={210} size={104} out={58} />
      {frame >= 62 ? (
        <>
          <Flash at={62} length={12} strength={0.85} />
          <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: 170 }}>
            <div style={{ transform: `scale(${0.4 + logo * 0.6})`, opacity: logo, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
              <Img src={staticFile('icon.png')} style={{ width: 230, height: 230, borderRadius: 52, boxShadow: `0 0 60px ${GOLD}aa` }} />
              <div
                style={{
                  direction: 'rtl',
                  fontFamily: FONT,
                  fontWeight: 700,
                  fontSize: 118,
                  color: GOLD,
                  textShadow: '0 6px 28px rgba(0,0,0,0.85)',
                  whiteSpace: 'nowrap',
                }}
              >
                טריוויה - האלוף
              </div>
            </div>
          </AbsoluteFill>
          <Shock at={64} max={1500} />
        </>
      ) : null}
    </AbsoluteFill>
  );
}

const CATS: { label: string; img: string }[] = [
  { label: 'חיות', img: 'worlds/nature.webp' },
  { label: 'חלל', img: 'worlds/space.webp' },
  { label: 'היסטוריה', img: 'worlds/history.webp' },
  { label: 'כדורגל', img: 'worlds/football.webp' },
];
const CAT_AT = [26, 39, 54, 74];
const ANSWERS = ['פיל אפריקני', 'לווייתן כחול', "ג'ירפה", 'היפופוטם'];

function QuestionScene() {
  const frame = useCurrentFrame();
  const card = useEnter(0, 13);
  const picked = frame >= 62;
  const correct = frame >= 76;
  return (
    <AbsoluteFill>
      <StageBg />
      <Glow color={VIOLET} size={1300} y={900} opacity={0.6} />
      {/* category chips */}
      <div style={{ position: 'absolute', top: 150, left: 40, right: 40, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 22, direction: 'rtl' }}>
        {CATS.map((c, i) => {
          const s = spring({ frame: frame - CAT_AT[i]!, fps: FPS, config: { damping: 10 } });
          return (
            <div
              key={c.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '10px 26px 10px 10px',
                borderRadius: 999,
                background: 'rgba(20,12,51,0.85)',
                border: `3px solid ${GOLD}`,
                transform: `scale(${s})`,
                opacity: s,
                direction: 'rtl',
              }}
            >
              <Img src={staticFile(c.img)} style={{ width: 74, height: 74, borderRadius: 37, objectFit: 'cover' }} />
              <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 52, color: '#FFFFFF' }}>{c.label}</span>
            </div>
          );
        })}
      </div>
      {/* question card */}
      <div
        style={{
          position: 'absolute',
          top: 520,
          left: 70,
          right: 70,
          padding: 44,
          borderRadius: 48,
          background: 'linear-gradient(180deg, #2C1A6E, #1E1250)',
          border: '4px solid rgba(255,255,255,0.18)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
          transform: `translateY(${(1 - card) * 300}px) rotate(${(1 - card) * -6}deg)`,
          opacity: card,
          direction: 'rtl',
        }}
      >
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 40, color: VIOLET, marginBottom: 14 }}>שאלה 4 מתוך 10</div>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 64, lineHeight: 1.2, color: '#FFFFFF', marginBottom: 36 }}>
          איזו חיה היא היונק הגדול ביותר בעולם?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {ANSWERS.map((a, i) => {
            const s = spring({ frame: frame - 8 - i * 5, fps: FPS, config: { damping: 14 } });
            const isRight = i === 1;
            const bg = correct && isRight ? GREEN : picked && isRight ? GOLD : 'rgba(255,255,255,0.08)';
            const pulse = correct && isRight ? 1 + 0.04 * Math.sin((frame - 76) / 2.5) * Math.max(0, 1 - (frame - 76) / 30) : 1;
            return (
              <div
                key={a}
                style={{
                  padding: '26px 34px',
                  borderRadius: 30,
                  background: bg,
                  border: `3px solid ${correct && isRight ? '#FFFFFF' : 'rgba(255,255,255,0.2)'}`,
                  fontFamily: FONT,
                  fontWeight: 700,
                  fontSize: 52,
                  color: (picked || correct) && isRight ? NIGHT : '#FFFFFF',
                  transform: `translateX(${(1 - s) * -200}px) scale(${pulse})`,
                  opacity: s,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{a}</span>
                {correct && isRight ? <span style={{ fontSize: 60 }}>✓</span> : null}
              </div>
            );
          })}
        </div>
      </div>
      {/* +100 coins */}
      {correct ? (
        <div
          style={{
            position: 'absolute',
            top: interpolate(frame, [76, 110], [1380, 1250], clamp),
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 110,
            color: GOLD,
            opacity: interpolate(frame, [76, 82, 110, 120], [0, 1, 1, 0], clamp),
            textShadow: '0 6px 24px rgba(0,0,0,0.8)',
            direction: 'ltr',
          }}
        >
          +100
        </div>
      ) : null}
      <Sparkles at={76} y={1000} seed="q" />
      <Shock at={76} color={GREEN} y={980} max={1000} />
    </AbsoluteFill>
  );
}

const WORLDS = ['nature', 'space', 'science', 'history', 'israel', 'geography', 'football', 'sport', 'food', 'music', 'screen', 'culture', 'people'];

function WorldsScene() {
  const frame = useCurrentFrame();
  const title = spring({ frame: frame - 2, fps: FPS, config: { damping: 10 } });
  const sub = interpolate(frame, [20, 32], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Img
        src={staticFile('paths/space.webp')}
        style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1.15 - frame * 0.001}) translateY(${frame * 1.2}px)` }}
      />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(14,6,40,0.85), rgba(14,6,40,0.35) 45%, rgba(14,6,40,0.8))' }} />
      <div
        style={{
          position: 'absolute',
          top: 150,
          left: 0,
          right: 0,
          textAlign: 'center',
          direction: 'rtl',
          fontFamily: FONT,
          fontWeight: 700,
          color: '#FFFFFF',
          textShadow: '0 6px 24px rgba(0,0,0,0.8)',
        }}
      >
        <div style={{ fontSize: 150, color: GOLD, lineHeight: 1.1, transform: `scale(${title})` }}>עולמות ידע</div>
        <div style={{ fontSize: 76, opacity: sub }}>בכל נושא שאפשר לדמיין</div>
      </div>
      {/* world cards fanning in */}
      <div style={{ position: 'absolute', top: 700, left: 0, right: 0, height: 1000 }}>
        {WORLDS.map((w, i) => {
          const s = spring({ frame: frame - 4 - i * 3, fps: FPS, config: { damping: 12 } });
          const col = i % 4;
          const row = Math.floor(i / 4);
          const x = i === 12 ? 425 : 60 + col * 245 + (row % 2 ? 60 : 0);
          const y = row * 260 + Math.sin((frame + i * 9) / 14) * 8;
          return (
            <div
              key={w}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: 230,
                height: 230,
                borderRadius: 40,
                overflow: 'hidden',
                border: `4px solid ${GOLD}`,
                boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
                transform: `scale(${s}) rotate(${(1 - s) * 30 + (i % 2 ? 3 : -3)}deg)`,
                opacity: s,
              }}
            >
              <Img src={staticFile(`worlds/${w}.webp`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

const STICKERS = ['dinos_12', 'space_07', 'myths_12', 'ocean_05', 'wild_12', 'vehicles_09', 'pets_04'];
const RARE = new Set([0, 2, 4]);

function PackScene() {
  const frame = useCurrentFrame();
  const CUT = 42; // AI clip of the sloth tearing the pack, then the stickers
  const title = spring({ frame: frame - CUT - 4, fps: FPS, config: { damping: 9 } });
  return (
    <AbsoluteFill>
      {frame < CUT ? (
        <>
          <Clip src="pack.mp4" from={45} zoom={0.0015} />
          <Headline text="פותחים חבילות" top={170} size={104} delay={4} />
        </>
      ) : (
        <>
          <StageBg tint={GOLD} />
          <Glow color={GOLD} size={1400} y={1050} opacity={0.7} />
          <Flash at={CUT} length={12} />
          <Shock at={CUT + 1} max={1600} />
          <div
            style={{
              position: 'absolute',
              top: 160,
              left: 0,
              right: 0,
              textAlign: 'center',
              direction: 'rtl',
              fontFamily: FONT,
              fontWeight: 700,
              color: '#FFFFFF',
              textShadow: '0 6px 24px rgba(0,0,0,0.85)',
            }}
          >
            <div style={{ fontSize: 140, color: GOLD, lineHeight: 1.1, transform: `scale(${title})` }}>מדבקות נדירות</div>
            <div style={{ fontSize: 84, opacity: title }}>אספו את כולן!</div>
          </div>
          {STICKERS.map((s, i) => {
            const n = STICKERS.length;
            const side = i - (n - 1) / 2;
            const sp = spring({ frame: frame - CUT - 4 - i * 4, fps: FPS, config: { damping: 11 } });
            const x = 540 + side * 138 - 130;
            const y = 900 + Math.abs(side) * 46 - sp * 60;
            const rare = RARE.has(i);
            return (
              <div
                key={s}
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: 260,
                  height: 330,
                  borderRadius: 26,
                  background: rare ? `linear-gradient(160deg, ${GOLD}, #FF7AD9)` : '#2C1A6E',
                  padding: 8,
                  boxShadow: rare ? `0 0 50px ${GOLD}` : '0 18px 40px rgba(0,0,0,0.6)',
                  transform: `translateY(${(1 - sp) * 500}px) rotate(${side * 8 * sp}deg) scale(${(0.4 + sp * 0.6) * (side === 0 ? 1.12 : 0.92 - Math.abs(side) * 0.04)})`,
                  opacity: sp,
                  zIndex: 10 - Math.abs(side),
                }}
              >
                <Img src={staticFile(`stickers/${s}.webp`)} style={{ width: 244, height: 244, borderRadius: 20, objectFit: 'cover' }} />
                <div style={{ height: 62, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 700, fontSize: 38, color: rare ? NIGHT : '#FFFFFF' }}>
                  {rare ? 'אגדית!' : 'חדשה!'}
                </div>
              </div>
            );
          })}
          <Sparkles at={CUT + 2} y={1200} count={22} radius={600} seed="p" />
        </>
      )}
    </AbsoluteFill>
  );
}

const BOARD = [
  { name: 'נועה', score: '12,480', av: 'a33' },
  { name: 'איתי', score: '11,920', av: 'a31' },
  { name: 'אתה', score: '11,875', av: 'a38', me: true },
  { name: 'מאיה', score: '10,340', av: 'a36' },
];

function FriendsScene() {
  const frame = useCurrentFrame();
  // "you" climbs from 3rd to 1st
  const climb = interpolate(frame, [40, 62], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const ROW = 190;
  return (
    <AbsoluteFill>
      <StageBg />
      <Glow color={VIOLET} size={1300} y={1100} opacity={0.55} />
      <Headline text="מתחרים בחברים" top={170} size={100} />
      <Headline text="ומטפסים לפסגה" top={300} size={84} color={GOLD} delay={36} />
      <div style={{ position: 'absolute', top: 560, left: 80, right: 80, height: ROW * 4 }}>
        {BOARD.map((b, i) => {
          const s = spring({ frame: frame - 4 - i * 5, fps: FPS, config: { damping: 13 } });
          let pos = i;
          if (b.me) pos = 2 - 2 * climb;
          else if (i < 2) pos = i + climb;
          const rank = Math.round(pos) + 1;
          return (
            <div
              key={b.name}
              style={{
                position: 'absolute',
                top: pos * ROW,
                left: 0,
                right: 0,
                height: ROW - 26,
                borderRadius: 40,
                display: 'flex',
                alignItems: 'center',
                gap: 28,
                padding: '0 34px',
                direction: 'rtl',
                background: b.me ? `linear-gradient(90deg, ${GOLD}, #FFE08A)` : 'rgba(30,18,80,0.92)',
                border: `3px solid ${b.me ? '#FFFFFF' : 'rgba(255,255,255,0.15)'}`,
                boxShadow: b.me ? `0 0 ${30 + climb * 40}px ${GOLD}` : '0 14px 34px rgba(0,0,0,0.5)',
                transform: `translateX(${(1 - s) * 900}px) scale(${b.me ? 1 + climb * 0.06 : 1})`,
                zIndex: b.me ? 5 : 1,
              }}
            >
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 60, width: 70, textAlign: 'center', color: b.me ? NIGHT : VIOLET }}>{rank}</div>
              <Img src={staticFile(`avatars/${b.av}.webp`)} style={{ width: 120, height: 120, borderRadius: 60, border: '4px solid #FFFFFF' }} />
              <div style={{ flex: 1, fontFamily: FONT, fontWeight: 700, fontSize: 58, color: b.me ? NIGHT : '#FFFFFF' }}>{b.name}</div>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 50, color: b.me ? NIGHT : GOLD, direction: 'ltr' }}>{b.score}</div>
            </div>
          );
        })}
      </div>
      <Sparkles at={62} y={640} seed="f" />
    </AbsoluteFill>
  );
}

function FinaleScene() {
  const frame = useCurrentFrame();
  const END = 30; // trophy clip, then the end card
  const card = spring({ frame: frame - END, fps: FPS, config: { damping: 11 } });
  const pulse = 1 + 0.03 * Math.sin((frame - END) / 5);
  return (
    <AbsoluteFill>
      <Clip src="trophy.mp4" zoom={0.0012} />
      {frame < END ? <Headline text="הורידו עכשיו!" top={180} size={112} color={GOLD} delay={0} out={END - 6} /> : null}
      {frame >= END ? (
        <>
          <AbsoluteFill style={{ background: `rgba(14,6,40,${0.78 * card})` }} />
          <Flash at={END} length={10} strength={0.7} />
          <Shock at={END + 1} max={1500} />
          <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 34, transform: `scale(${0.6 + card * 0.4})`, opacity: card }}>
            <Img src={staticFile('icon.png')} style={{ width: 300, height: 300, borderRadius: 68, boxShadow: `0 0 80px ${GOLD}` }} />
            <div style={{ direction: 'rtl', fontFamily: FONT, fontWeight: 700, fontSize: 124, color: GOLD, textShadow: '0 6px 28px rgba(0,0,0,0.85)', whiteSpace: 'nowrap' }}>
              טריוויה - האלוף
            </div>
            <div style={{ direction: 'rtl', fontFamily: FONT, fontWeight: 700, fontSize: 70, color: '#FFFFFF', textShadow: '0 6px 20px rgba(0,0,0,0.8)' }}>
              מי יהיה האלוף?
            </div>
            <div
              style={{
                marginTop: 30,
                padding: '30px 64px',
                borderRadius: 999,
                background: `linear-gradient(180deg, #FFE08A, ${GOLD})`,
                border: '4px solid #FFFFFF',
                boxShadow: `0 10px 0 #C98A00, 0 0 50px ${GOLD}aa`,
                transform: `scale(${pulse})`,
                direction: 'rtl',
                fontFamily: FONT,
                fontWeight: 700,
                fontSize: 64,
                color: NIGHT,
              }}
            >
              חינם ב-Google Play
            </div>
          </AbsoluteFill>
          <Sparkles at={END + 2} count={24} radius={650} seed="e" />
        </>
      ) : null}
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

// Scene starts (frames). The narration starts at 0.4s; cuts follow its sentences.
const T = { hook: 0, q: 107, worlds: 220, pack: 317, friends: 415, finale: 514 };

export const Promo: React.FC = () => {
  const frame = useCurrentFrame();
  const musicVol = interpolate(frame, [0, 10, DURATION - 30, DURATION], [0, 0.22, 0.22, 0], clamp);
  return (
    <AbsoluteFill style={{ background: NIGHT }}>
      <Sequence from={T.hook} durationInFrames={T.q - T.hook}>
        <HookScene />
      </Sequence>
      <Sequence from={T.q} durationInFrames={T.worlds - T.q}>
        <QuestionScene />
      </Sequence>
      <Sequence from={T.worlds} durationInFrames={T.pack - T.worlds}>
        <WorldsScene />
      </Sequence>
      <Sequence from={T.pack} durationInFrames={T.friends - T.pack}>
        <PackScene />
      </Sequence>
      <Sequence from={T.friends} durationInFrames={T.finale - T.friends}>
        <FriendsScene />
      </Sequence>
      <Sequence from={T.finale} durationInFrames={DURATION - T.finale}>
        <FinaleScene />
      </Sequence>
      <Dust seed="all" count={30} />

      {/* quick white flashes on every cut */}
      {[T.q, T.worlds, T.friends, T.finale].map((t) => (
        <Flash key={t} at={t} length={7} strength={0.5} />
      ))}

      <Audio src={staticFile('theme.m4a')} volume={musicVol} loop />
      <Sequence from={12}>
        <Audio src={staticFile('vo2.mp3')} volume={1} />
      </Sequence>
      <Sequence from={T.hook + 62}>
        <Audio src={staticFile('sfx/level_up.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={T.q + 62}>
        <Audio src={staticFile('sfx/answer_lock.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={T.q + 76}>
        <Audio src={staticFile('sfx/answer_correct.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={T.q + 80}>
        <Audio src={staticFile('sfx/coins.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={T.pack + 38}>
        <Audio src={staticFile('sfx/pack_open.wav')} volume={0.7} />
      </Sequence>
      <Sequence from={T.pack + 46}>
        <Audio src={staticFile('sfx/rare_reveal.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={T.friends + 60}>
        <Audio src={staticFile('sfx/solved.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={T.finale + 30}>
        <Audio src={staticFile('sfx/level_up.wav')} volume={0.6} />
      </Sequence>
    </AbsoluteFill>
  );
};
