import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import { useBrowser, Tab } from '@/lib/browser-context';
import { Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { RootStackParamList } from '@/navigation/RootStackNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface TabCardProps {
  tab: Tab;
  isActive: boolean;
  onPress: () => void;
  onClose: () => void;
}

function TabCard({ tab, isActive, onPress, onClose }: TabCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, springConfig);
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

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.tabCard,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: isActive ? theme.primary : theme.border,
          borderWidth: isActive ? 2 : 1,
        },
        animatedStyle,
      ]}
    >
      <View style={styles.tabCardHeader}>
        <Feather name="globe" size={16} color={theme.textSecondary} />
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.closeButtonPressed,
          ]}
          hitSlop={8}
        >
          <Feather name="x" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>
      <ThemedText type="body" numberOfLines={2} style={styles.tabTitle}>
        {tab.title || 'New Tab'}
      </ThemedText>
      <ThemedText type="small" numberOfLines={1} style={{ color: theme.textSecondary }}>
        {extractDomain(tab.url)}
      </ThemedText>
    </AnimatedPressable>
  );
}

export default function TabSwitcherScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { tabs, activeTabId, setActiveTab, closeTab, createTab } = useBrowser();

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: `Tabs (${tabs.length})`,
      headerStyle: { backgroundColor: theme.backgroundRoot },
      headerTintColor: theme.text,
      headerRight: () => (
        <HeaderButton
          onPress={handleNewTab}
          pressColor={theme.primary}
        >
          <Feather name="plus" size={24} color={theme.primary} />
        </HeaderButton>
      ),
    });
  }, [navigation, tabs.length, theme.primary, theme.backgroundRoot, theme.text]);

  const handleNewTab = useCallback(() => {
    if (tabs.length >= 10) {
      Alert.alert('Tab Limit Reached', 'You can have a maximum of 10 tabs open.');
      return;
    }
    const newTabId = createTab();
    setActiveTab(newTabId);
    navigation.goBack();
  }, [createTab, setActiveTab, tabs.length, navigation]);

  const handleSelectTab = useCallback((tabId: string) => {
    setActiveTab(tabId);
    navigation.goBack();
  }, [setActiveTab, navigation]);

  const handleCloseTab = useCallback((tabId: string) => {
    closeTab(tabId);
  }, [closeTab]);

  const renderTab = ({ item }: { item: Tab }) => (
    <TabCard
      tab={item}
      isActive={item.id === activeTabId}
      onPress={() => handleSelectTab(item.id)}
      onClose={() => handleCloseTab(item.id)}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="layers" size={64} color={theme.textSecondary} />
      <ThemedText type="h4" style={styles.emptyTitle}>
        No tabs open
      </ThemedText>
      <Pressable
        onPress={handleNewTab}
        style={({ pressed }) => [
          styles.newTabButton,
          { backgroundColor: theme.primary },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Feather name="plus" size={20} color="#FFFFFF" />
        <ThemedText style={styles.newTabButtonText}>New Tab</ThemedText>
      </Pressable>
    </View>
  );

  return (
   <ThemedView style={styles.container}>
      <FlatList
        data={tabs}
        renderItem={renderTab}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.lg,
    flexGrow: 1,
  },
  row: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  tabCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    minHeight: 120,
  },
  tabCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  closeButtonPressed: {
    opacity: 0.6,
  },
  tabTitle: {
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  newTabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  newTabButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
