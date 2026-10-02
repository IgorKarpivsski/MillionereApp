import { router } from 'expo-router';
import { Screen, EmptyState } from '@/design-system/components';

export default function NotFound() {
  return (
    <Screen scroll={false}>
      <EmptyState
        icon="flag-outline"
        title="המסך הזה לא קיים"
        body="אולי הקישור ישן. חזור למסך הבית."
        actionLabel="למסך הבית"
        onAction={() => router.replace('/')}
      />
    </Screen>
  );
}
