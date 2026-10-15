import { Ionicons } from '@expo/vector-icons';
import { MATCH_PUZZLES } from '@fm/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/design-system/components';
import { colors, radius, space } from '@/design-system/tokens';
import { usePuzzlesState } from '@/features/puzzles/api';
import { fmt, strings } from '@/lib/i18n';

const t = strings.puzzles;
const LEVEL_COLORS = ['#22B07D', '#3E8EF7', '#7B5CF0', '#E2557B', '#F2694B'];

export default function PuzzlesScreen() {
  const { data } = usePuzzlesState();
  const solved = useMemo(() => new Set(data?.solved ?? []), [data]);
  // Open = everything up to 3 past the furthest solved puzzle (so a hard one never blocks you).
  const furthest = MATCH_PUZZLES.reduce((m, p) => (solved.has(p.id) ? Math.max(m, p.id) : m), 0);
  const openUpTo = Math.max(furthest + 3, solved.size + 3);
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <LinearGradient colors={['#5A2EA6', colors.bg]} style={styles.glow} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={strings.common.back}>
          <Ionicons name="arrow-forward" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <AppText variant="title">{t.title}</AppText>
          <AppText color={colors.textMuted}>{fmt(t.progress, { n: solved.size, total: MATCH_PUZZLES.length })}</AppText>
        </View>
        <AppText style={styles.emoji}>🔥</AppText>
      </View>
      <FlatList
        data={MATCH_PUZZLES}
        keyExtractor={(p) => String(p.id)}
        numColumns={5}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        initialNumToRender={60}
        renderItem={({ item: p }) => {
          const done = solved.has(p.id);
          const open = done || p.id <= openUpTo;
          const c = LEVEL_COLORS[p.level - 1] ?? colors.led;
          return (
            <Pressable
              disabled={!open}
              onPress={() => router.push({ pathname: '/puzzles/[id]', params: { id: String(p.id) } })}
              accessibilityRole="button"
              accessibilityLabel={`${fmt(t.puzzleN, { n: p.id })}${done ? ', נפתר' : open ? '' : ', נעול'}`}
              style={({ pressed }) => [styles.cell, { backgroundColor: open ? c : '#3B3170', borderBottomColor: open ? '#00000055' : '#2A2358' }, pressed && styles.pressed]}
            >
              {open ? (
                <AppText variant="heading" color={colors.textOnBright} style={styles.num}>
                  {p.id}
                </AppText>
              ) : (
                <Ionicons name="lock-closed" size={18} color="#8F86C4" />
              )}
              {done ? <Ionicons name="checkmark-circle" size={18} color={colors.textOnBright} style={styles.check} /> : null}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  flex: { flex: 1 },
  emoji: { fontSize: 34, lineHeight: 42 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  grid: { padding: space.md, gap: space.sm, paddingBottom: space.xxl },
  row: { gap: space.sm },
  cell: { flex: 1, aspectRatio: 1, borderRadius: radius.board, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 5 },
  num: { fontSize: 20 },
  check: { position: 'absolute', top: 3, end: 3 },
  pressed: { transform: [{ translateY: 2 }] },
});
