import { Ionicons } from '@expo/vector-icons';
import type { ChatMessage, ChatReportReason } from '@fm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, BottomSheet, StickerButton, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { colors, palette, radius, space } from '@/design-system/tokens';
import { RpcError } from '@/features/profile/api';
import { socialApi } from '@/features/social/api';
import { useChat } from '@/features/social/hooks';
import { queryKeys } from '@/lib/queryClient';
import { fmt, strings } from '@/lib/i18n';

const t = strings.social;
const REASONS: ChatReportReason[] = ['rude', 'bullying', 'personal_info', 'spam', 'other'];

function Bubble({ m, onLongPress }: { m: ChatMessage; onLongPress: () => void }) {
  const time = new Date(m.at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  return (
    <Pressable
      onLongPress={m.mine ? undefined : onLongPress}
      delayLongPress={350}
      accessibilityRole="text"
      accessibilityLabel={`${m.mine ? 'אתה' : 'חבר'}: ${m.body}, ${time}`}
      accessibilityHint={m.mine ? undefined : t.reportTitle}
      accessibilityActions={m.mine ? undefined : [{ name: 'longpress', label: t.reportTitle }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && onLongPress()}
      style={[styles.bubble, m.mine ? styles.mine : styles.theirs]}
    >
      <AppText color={m.mine ? colors.textOnBright : colors.text}>{m.body}</AppText>
      <AppText variant="caption" color={m.mine ? palette.night700 : colors.textDim} style={styles.time}>
        {time}
      </AppText>
    </Pressable>
  );
}

export default function ChatScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { data } = useChat(id);
  const qc = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState<ChatMessage | null>(null);
  const list = useRef<FlatList<ChatMessage>>(null);
  const count = data?.messages.length ?? 0;

  useEffect(() => {
    if (count) setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
  }, [count]);

  const send = async (body: string) => {
    const b = body.trim();
    if (!b || sending) return;
    setSending(true);
    try {
      const r = await socialApi.send(id, b);
      setText('');
      haptic('tap');
      if (r.masked) toast(t.masked, 'info');
      void qc.invalidateQueries({ queryKey: queryKeys.chat(id) });
    } catch (e) {
      toast(e instanceof RpcError && e.code === 'rate_limited' ? strings.errors.rateLimited : t.cantSend, 'error');
    } finally {
      setSending(false);
    }
  };

  const doReport = async (reason: ChatReportReason) => {
    if (!report) return;
    try {
      await socialApi.report(report.id, reason);
      toast(t.reported, 'success');
      void qc.invalidateQueries({ queryKey: queryKeys.chat(id) });
    } catch {
      toast(strings.errors.generic, 'error');
    } finally {
      setReport(null);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel={strings.common.close}>
          <Ionicons name="chevron-forward" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="heading" numberOfLines={1} style={styles.flex}>
          {fmt(t.chatTitle, { name: name ?? '' })}
        </AppText>
        <Ionicons name="shield-checkmark" size={20} color={colors.correct} accessibilityLabel={t.safety} />
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={list}
          data={data?.messages ?? []}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <Bubble m={item} onLongPress={() => setReport(item)} />}
          ListEmptyComponent={
            <AppText color={colors.textDim} align="center" style={styles.empty}>
              {t.emptyChat}
            </AppText>
          }
        />
        {data && !data.can_send ? (
          <AppText color={colors.textDim} align="center" style={styles.pad}>
            {t.cantSend}
          </AppText>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quick} keyboardShouldPersistTaps="handled">
              {t.quick.map((q) => (
                <Pressable key={q} onPress={() => void send(q)} style={styles.chip} accessibilityRole="button" accessibilityLabel={q}>
                  <AppText variant="caption">{q}</AppText>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.composer}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={t.typeHere}
                placeholderTextColor={colors.textDim}
                style={styles.input}
                maxLength={300}
                multiline
                accessibilityLabel={t.typeHere}
              />
              <StickerButton label={t.send} icon="send" size="sm" loading={sending} disabled={!text.trim()} onPress={() => void send(text)} />
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      <BottomSheet visible={!!report} onClose={() => setReport(null)} title={t.reportTitle}>
        <AppText color={colors.textMuted}>{t.reportBody}</AppText>
        {REASONS.map((r) => (
          <StickerButton key={r} label={t.reasons[r]} tone="outline" fullWidth onPress={() => void doReport(r)} />
        ))}
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  list: { padding: space.md, gap: space.sm, flexGrow: 1 },
  empty: { marginTop: space.xxl },
  pad: { padding: space.lg },
  bubble: { maxWidth: '80%', paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.card, gap: 2 },
  mine: { alignSelf: 'flex-start', backgroundColor: colors.led, borderBottomStartRadius: 4 },
  theirs: { alignSelf: 'flex-end', backgroundColor: colors.surfaceRaised, borderBottomEndRadius: 4 },
  time: { fontSize: 11 },
  quick: { paddingHorizontal: space.md, gap: space.sm, paddingBottom: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.chip, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.board },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, padding: space.md, borderTopWidth: 1, borderColor: colors.border },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.control,
    backgroundColor: colors.board,
    color: colors.text,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: 16,
    textAlign: 'right',
    fontFamily: 'IBMPlexSansHebrew_400Regular',
  },
});
