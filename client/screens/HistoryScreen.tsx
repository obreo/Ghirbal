import React, { useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SectionList,
  Pressable,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { HeaderButton } from '@react-navigation/elements';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  WithSpringConfig,
} from 'react-native-reanimated';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useBrowser, HistoryItem } from '@/lib/browser-context';
import { Spacing, BorderRadius } from '@/constants/theme';

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface HistoryRowProps {
  item: HistoryItem;
  onPress: () => void;
}

function HistoryRow({ item, onPress }: HistoryRowProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, springConfig);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  const extractDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.historyItem,
        { backgroundColor: theme.backgroundDefault },
        animatedStyle,
      ]}
    >
      <ThemedText type="small" style={[styles.timeText, { color: theme.textSecondary }]}>
        {formatTime(item.visitedAt)}
      </ThemedText>
      <View style={styles.historyInfo}>
        <ThemedText type="body" numberOfLines={1} style={styles.historyTitle}>
          {item.title}
        </ThemedText>
        <ThemedText type="small" numberOfLines={1} style={{ color: theme.textSecondary }}>
          {extractDomain(item.url)}
        </ThemedText>
      </View>
    </AnimatedPressable>
  );
}

export default function HistoryScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { history, clearHistory, updateTab, activeTabId } = useBrowser();

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all browsing history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: clearHistory,
        },
      ]
    );
  }, [clearHistory]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: 'History',
      headerStyle: { backgroundColor: theme.backgroundRoot },
      headerTintColor: theme.text,
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          style={{ paddingHorizontal: Spacing.md }}
        >
          <Feather name="menu" size={24} color={theme.text} />
        </Pressable>
      ),
      headerRight: () => (
        history.length > 0 ? (
          <HeaderButton onPress={handleClearHistory} pressColor={theme.error}>
            <ThemedText style={{ color: theme.error }}>Clear</ThemedText>
          </HeaderButton>
        ) : null
      ),
    });
  }, [navigation, theme, history.length, handleClearHistory]);

  const groupedHistory = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const groups: { title: string; data: HistoryItem[] }[] = [
      { title: 'Today', data: [] },
      { title: 'Yesterday', data: [] },
      { title: 'Last 7 Days', data: [] },
      { title: 'Older', data: [] },
    ];

    history.forEach((item) => {
      const itemDate = new Date(item.visitedAt);
      const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());

      if (itemDay.getTime() >= today.getTime()) {
        groups[0].data.push(item);
      } else if (itemDay.getTime() >= yesterday.getTime()) {
        groups[1].data.push(item);
      } else if (itemDay.getTime() >= lastWeek.getTime()) {
        groups[2].data.push(item);
      } else {
        groups[3].data.push(item);
      }
    });

    return groups.filter((group) => group.data.length > 0);
  }, [history]);

  const handleHistoryPress = useCallback((url: string) => {
    if (activeTabId) {
      updateTab(activeTabId, { url, sourceUrl: url });
    }
    navigation.navigate('Browser' as never);
  }, [activeTabId, updateTab, navigation]);

  const renderHistoryItem = ({ item }: { item: HistoryItem }) => (
    <HistoryRow
      item={item}
      onPress={() => handleHistoryPress(item.url)}
    />
  );

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={[styles.sectionHeader, { backgroundColor: theme.backgroundRoot }]}>
      <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        {section.title}
      </ThemedText>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="clock" size={64} color={theme.textSecondary} />
      <ThemedText type="h4" style={styles.emptyTitle}>
        No history
      </ThemedText>
      <ThemedText type="body" style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Pages you visit will appear here
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <SectionList
        sections={groupedHistory}
        renderItem={renderHistoryItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    flexGrow: 1,
  },
  sectionHeader: {
    paddingVertical: Spacing.md,
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  timeText: {
    width: 56,
    marginRight: Spacing.md,
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  separator: {
    height: Spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    textAlign: 'center',
  },
});
