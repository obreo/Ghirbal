import React from 'react';
import {
  View,
  StyleSheet,
  FlatList,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { BLOCKED_SITES_LIST } from '@/lib/content-filter';
import { Spacing, BorderRadius } from '@/constants/theme';

interface BlockedSiteItemProps {
  domain: string;
}

function BlockedSiteItem({ domain }: BlockedSiteItemProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.siteItem, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.iconContainer, { backgroundColor: theme.error }]}>
        <Feather name="slash" size={16} color="#FFFFFF" />
      </View>
      <ThemedText type="body" style={styles.domainText}>
        {domain}
      </ThemedText>
    </View>
  );
}

export default function BlockedSitesScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const renderItem = ({ item }: { item: string }) => (
    <BlockedSiteItem domain={item} />
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={[styles.warningBox, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="alert-circle" size={20} color={theme.primary} />
        <ThemedText type="small" style={styles.warningText}>
          These websites are blocked to ensure safe browsing. This list cannot be modified.
        </ThemedText>
      </View>
      <ThemedText type="small" style={[styles.countText, { color: theme.textSecondary }]}>
        {BLOCKED_SITES_LIST.length} blocked sites
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={BLOCKED_SITES_LIST}
        renderItem={renderItem}
        keyExtractor={(item) => item}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        ListHeaderComponent={renderHeader}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  },
  header: {
    marginBottom: Spacing.lg,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.md,
  },
  warningText: {
    flex: 1,
  },
  countText: {
    marginTop: Spacing.md,
    marginLeft: Spacing.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  siteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  domainText: {
    flex: 1,
  },
  separator: {
    height: Spacing.sm,
  },
});
