import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useBrowser } from '@/lib/browser-context';
import { Spacing, BorderRadius } from '@/constants/theme';
import { RootStackParamList } from '@/navigation/RootStackNavigator';


type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

function SettingsSection({ title, children }: SettingsSectionProps) {
  const { theme } = useTheme();
  
  return (
    <View style={styles.section}>
      <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        {title}
      </ThemedText>
      <View style={[styles.sectionContent, { backgroundColor: theme.backgroundDefault }]}>
        {children}
      </View>
    </View>
  );
}

interface SettingsRowProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  destructive?: boolean;
}

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  rightElement,
  showChevron = false,
  destructive = false,
}: SettingsRowProps) {
  const { theme } = useTheme();
  
  const content = (
    <View style={styles.row}>
      <View style={[styles.iconContainer, { backgroundColor: destructive ? theme.error : theme.primary }]}>
        <Feather name={icon} size={16} color="#FFFFFF" />
      </View>
      <View style={styles.rowContent}>
        <ThemedText
          type="body"
          style={[styles.rowTitle, destructive && { color: theme.error }]}
        >
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {rightElement}
      {showChevron ? (
        <Feather name="chevron-right" size={18} color={theme.textSecondary} />
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [pressed && { opacity: 0.7 }]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

function SettingsDivider() {
  const { theme } = useTheme();
  return (
    <View style={[styles.divider, { backgroundColor: theme.border }]} />
  );
}

export default function SettingsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { clearHistory, clearBookmarks, requestCacheClear, clearAllData, history, bookmarks } = useBrowser();

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: 'Settings',
      headerStyle: { backgroundColor: theme.backgroundRoot },
      headerTintColor: theme.text,
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          style={{ paddingHorizontal: Spacing.md }}
        >
          <Feather name="menu" size={22} color={theme.text} />
        </Pressable>
      ),
    });
  }, [navigation, theme]);

  const handleClearHistory = useCallback(() => {
    if (history.length === 0) {
      Alert.alert('No History', 'Your browsing history is already empty.');
      return;
    }
    
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all browsing history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: clearHistory,
        },
      ]
    );
  }, [clearHistory, history.length]);

  const handleClearBookmarks = useCallback(() => {
    if (bookmarks.length === 0) {
      Alert.alert('No Bookmarks', 'You have no bookmarks to clear.');
      return;
    }
    
    Alert.alert(
      'Clear Bookmarks',
      'Are you sure you want to delete all bookmarks? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: clearBookmarks,
        },
      ]
    );
  }, [clearBookmarks, bookmarks.length]);

const handleClearCookies = useCallback(() => {
  Alert.alert(
    'Clear Cookies and Cache',
    'This will clear all cookies and cache, logging you out of all websites. Continue?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          clearAllData();
          Alert.alert('Done', 'Cookies and cache cleared.');
        },
      },
    ]
  );
}, [clearAllData]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection title="Privacy">
          <SettingsRow
            icon="clock"
            title="Clear history"
            subtitle={`${history.length} items`}
            onPress={handleClearHistory}
            destructive
          />
          <SettingsDivider />
          <SettingsRow
            icon="bookmark"
            title="Clear bookmarks"
            subtitle={`${bookmarks.length} items`}
            onPress={handleClearBookmarks}
            destructive
          />
          <SettingsDivider />
          <SettingsRow
            icon="trash-2"
            title="Clear cookies and cache"
            subtitle="Log out of all websites"
            onPress={handleClearCookies}
            destructive
          />
        </SettingsSection>

        <View style={styles.footer}>
          <View style={[styles.logoContainer, { backgroundColor: theme.primary }]}>
            <Feather name="shield" size={20} color="#FFFFFF" />
          </View>
          <ThemedText type="body" style={styles.appName}>
            SafeBrowse
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Version 1.0.0
          </ThemedText>
          <ThemedText type="small" style={[styles.safetyNote, { color: theme.textSecondary }]}>
            Adult content blocking and SafeSearch are always enabled
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
    marginLeft: Spacing.xs,
    fontSize: 11,
  },
  sectionContent: {
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  rowContent: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  rowTitle: {
    fontWeight: '500',
    fontSize: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 44,
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  appName: {
    fontWeight: '600',
    marginBottom: Spacing.xs,
    fontSize: 15,
  },
  safetyNote: {
    marginTop: Spacing.md,
    textAlign: 'center',
    fontStyle: 'italic',
    fontSize: 11,
  },
});
