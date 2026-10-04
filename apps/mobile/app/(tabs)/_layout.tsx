import { Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';
import { strings } from '@/lib/i18n';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: strings.tabs.home }} />
      <Tabs.Screen name="play" options={{ title: strings.tabs.play }} />
      <Tabs.Screen name="packs" options={{ title: strings.tabs.packs }} />
      <Tabs.Screen name="collection" options={{ title: strings.tabs.collection }} />
      <Tabs.Screen name="leaderboard" options={{ title: strings.tabs.leaderboard }} />
      <Tabs.Screen name="profile" options={{ title: strings.tabs.profile, href: null }} />
    </Tabs>
  );
}
