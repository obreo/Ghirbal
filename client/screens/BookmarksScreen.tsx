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
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  WithSpringConfig,
  FadeIn,
  FadeOut,
  Layout,
} from 'react-native-reanimated';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useBrowser, Bookmark } from '@/lib/browser-context';
import { Spacing, BorderRadius } from '@/constants/theme';
import { RootStackParamList } from '@/navigation/RootStackNavigator';
import { DrawerParamList } from '@/navigation/DrawerNavigator';

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface BookmarkItemProps {
  bookmark: Bookmark;
  onPress: () => void;
  onDelete: () => void;
}

function BookmarkItem({ bookmark, onPress, onDelete }: BookmarkItemProps) {
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

  const handleLongPress = () => {
    Alert.alert(
      'Delete Bookmark',
      `Remove "${bookmark.title}" from bookmarks?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={handleLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.bookmarkItem,
        { backgroundColor: theme.backgroundDefault },
        animatedStyle,
      ]}
    >
      <View style={[styles.faviconContainer, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name="globe" size={20} color={theme.textSecondary} />
      </View>
      <View style={styles.bookmarkInfo}>
        <ThemedText type="body" numberOfLines={1} style={styles.bookmarkTitle}>
          {bookmark.title}
        </ThemedText>
        <ThemedText type="small" numberOfLines={1} style={{ color: theme.textSecondary }}>
          {extractDomain(bookmark.url)}
        </ThemedText>
      </View>
      <Pressable
        onPress={onDelete}
        style={({ pressed }) => [
          styles.deleteButton,
          pressed && { opacity: 0.6 },
        ]}
        hitSlop={8}
      >
        <Feather name="trash-2" size={18} color={theme.error} />
      </Pressable>
    </AnimatedPressable>
  );
}

export default function BookmarksScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { bookmarks, removeBookmark, updateTab, activeTabId, tabs } = useBrowser();

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: 'Bookmarks',
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
    });
  }, [navigation, theme]);

  const handleBookmarkPress = useCallback((url: string) => {
    if (activeTabId) {
      updateTab(activeTabId, { url, sourceUrl: url });
    }
    navigation.navigate('Browser' as never);
  }, [activeTabId, updateTab, navigation]);

  const handleDeleteBookmark = useCallback((id: string) => {
    removeBookmark(id);
  }, [removeBookmark]);

  const renderBookmark = ({ item }: { item: Bookmark }) => (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      layout={Layout.springify()}
    >
      <BookmarkItem
        bookmark={item}
        onPress={() => handleBookmarkPress(item.url)}
        onDelete={() => handleDeleteBookmark(item.id)}
      />
    </Animated.View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="bookmark" size={64} color={theme.textSecondary} />
      <ThemedText type="h4" style={styles.emptyTitle}>
        No bookmarks yet
      </ThemedText>
      <ThemedText type="body" style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Tap the bookmark icon in the browser to save your favorite pages
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={bookmarks}
        renderItem={renderBookmark}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    paddingHorizontal: Spacing.lg,
    flexGrow: 1,
  },
  bookmarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  faviconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  bookmarkInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  bookmarkTitle: {
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  deleteButton: {
    padding: Spacing.sm,
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
