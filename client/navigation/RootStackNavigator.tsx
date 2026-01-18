import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DrawerNavigator from '@/navigation/DrawerNavigator';
import TabSwitcherScreen from '@/screens/TabSwitcherScreen';
import { useScreenOptions } from '@/hooks/useScreenOptions';
import { useTheme } from '@/hooks/useTheme';

export type RootStackParamList = {
  Main: undefined;
  TabSwitcher: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions({ transparent: false });
  const { theme } = useTheme();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Main"
        component={DrawerNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TabSwitcher"
        component={TabSwitcherScreen}
        options={{
          presentation: 'modal',
          headerTitle: 'Tabs',
          headerStyle: {
            backgroundColor: theme.backgroundRoot,
          },
          headerTintColor: theme.text,
        }}
      />
    </Stack.Navigator>
  );
}
