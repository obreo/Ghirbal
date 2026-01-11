import React, { useState } from 'react';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerContentComponentProps } from '@react-navigation/drawer';
import { View, StyleSheet, Image, Pressable, Alert, FlatList, Text, Modal, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BrowserScreen from '@/screens/BrowserScreen';
import BookmarksScreen from '@/screens/BookmarksScreen';
import HistoryScreen from '@/screens/HistoryScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import { useTheme } from '@/hooks/useTheme';
import { useBrowser } from '@/lib/browser-context';
import { Spacing, BorderRadius } from '@/constants/theme';
import { ThemedText } from '@/components/ThemedText';

export type DrawerParamList = {
  Browser: undefined;
  Bookmarks: undefined;
  History: undefined;
  Settings: undefined;
};

const Drawer = createDrawerNavigator<DrawerParamList>();

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { pinnedSites, addPinnedSite, removePinnedSite, createTab, setActiveTab } = useBrowser();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const handleAddPinned = () => {
    setIsModalVisible(true);
  };

  const handlePinSite = () => {
    if (urlInput && urlInput.trim()) {
      let fullUrl = urlInput.trim();
      if (!fullUrl.startsWith('http')) {
        fullUrl = 'https://' + fullUrl;
      }
      try {
        const hostname = new URL(fullUrl).hostname;
        addPinnedSite(fullUrl, fullUrl); // Use full URL as title
        setUrlInput('');
        setIsModalVisible(false);
      } catch (e) {
        Alert.alert('Invalid URL', 'Please enter a valid website URL');
      }
    }
  };

  const handleCancelPin = () => {
    setUrlInput('');
    setIsModalVisible(false);
  };

  const handleLongPressPinned = (id: string, title: string) => {
    Alert.alert(
      'Remove Pinned Site',
      `Remove ${title} from pinned sites?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removePinnedSite(id)
        }
      ]
    );
  };

  return (
    <DrawerContentScrollView 
      {...props}
      contentContainerStyle={[
        styles.drawerContent,
        { paddingTop: insets.top },
      ]}
    >
      {/* Pinned Sites Section */}
      <View style={styles.pinnedSection}>
        <View style={styles.pinnedHeaderRow}>
          <ThemedText style={styles.pinnedTitle}>Pinned Sites</ThemedText>
          <Pressable
            onPress={handleAddPinned}
            disabled={pinnedSites.length >= 6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.addPinnedButton,
              { opacity: pinnedSites.length >= 6 ? 0.5 : (pressed ? 0.7 : 1) }
            ]}
          >
            <Feather name="plus" size={20} color={theme.primary} />
          </Pressable>
        </View>

        {pinnedSites.length > 0 ? (
          <View style={styles.pinnedList}>
            {pinnedSites.map((site) => (
              <Pressable
                key={site.id}
                onLongPress={() => handleLongPressPinned(site.id, site.title)}
                onPress={() => {
                  const newTabId = createTab(site.url);
                  setActiveTab(newTabId);
                  props.navigation.navigate('Browser');
                }}
                style={({ pressed }) => [
                  styles.pinnedItem,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  pressed && { opacity: 0.7 }
                ]}
              >
                <ThemedText style={styles.pinnedItemText} numberOfLines={1}>
                  {site.title}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ) : (
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            No pinned sites yet
          </ThemedText>
        )}
      </View>

      {/* Spacer to push menu items to bottom */}
      <View style={styles.spacer} />

      {/* Menu Items - Bottom */}
      <View style={styles.menuSection}>
        <DrawerItemList {...props} />
      </View>

      {/* Pin Site Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelPin}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <ThemedText style={styles.modalTitle}>Pin Site</ThemedText>
            <TextInput
              style={[styles.modalInput, { borderColor: theme.border, color: theme.text }]}
              placeholder="Enter website URL"
              placeholderTextColor={theme.textSecondary}
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <View style={styles.modalButtons}>
              <Pressable
                onPress={handleCancelPin}
                style={[styles.modalButton, { borderColor: theme.border }]}
              >
                <ThemedText style={[styles.modalButtonText, { color: theme.textSecondary }]}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handlePinSite}
                style={[styles.modalButton, styles.modalPrimaryButton, { backgroundColor: theme.primary }]}
              >
                <ThemedText style={[styles.modalButtonText, { color: theme.surface }]}>Pin</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </DrawerContentScrollView>
  );
}

export default function DrawerNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Drawer.Navigator
      initialRouteName="Browser"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: theme.primary,
        drawerInactiveTintColor: theme.text,
        drawerActiveBackgroundColor: isDark ? 'rgba(77, 163, 255, 0.15)' : 'rgba(26, 115, 232, 0.1)',
        drawerStyle: {
          backgroundColor: theme.backgroundRoot,
          width: 280,
        },
        drawerLabelStyle: {
          fontSize: 16,
          fontWeight: '500',
          marginLeft: Spacing.sm,
        },
        drawerItemStyle: {
          borderRadius: BorderRadius.sm,
          marginHorizontal: Spacing.sm,
          paddingVertical: Spacing.xs,
        },
      }}
    >
      <Drawer.Screen
        name="Browser"
        component={BrowserScreen}
        options={{
          title: 'Browser',
          drawerIcon: ({ color, size }) => (
            <Feather name="globe" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Bookmarks"
        component={BookmarksScreen}
        options={{
          title: 'Bookmarks',
          drawerIcon: ({ color, size }) => (
            <Feather name="bookmark" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'History',
          drawerIcon: ({ color, size }) => (
            <Feather name="clock" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          drawerIcon: ({ color, size }) => (
            <Feather name="settings" size={size} color={color} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawerContent: {
    flex: 1,
    paddingBottom: Spacing.lg,
  },
  pinnedSection: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  pinnedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.xl,
  },
  pinnedTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  addPinnedButton: {
    padding: Spacing.xs,
  },
  pinnedList: {
    gap: Spacing.sm,
  },
  pinnedItem: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    minHeight: 36,
    justifyContent: 'center',
  },
  pinnedItemText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: Spacing.sm,
  },
  spacer: {
    flex: 1,
  },
  menuSection: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    fontSize: 16,
    marginBottom: Spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalPrimaryButton: {
    borderWidth: 0,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
