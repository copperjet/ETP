import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../lib/theme';

export default function AdminLayout() {
  const { colors } = useTheme();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarShowLabel: false,
      tabBarStyle: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        borderTopWidth: StyleSheet.hairlineWidth,
        height: Platform.OS === 'ios' ? 84 : 64,
        paddingBottom: Platform.OS === 'ios' ? 24 : 8,
      },
    }}>
      <Tabs.Screen name="home" options={{ tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={color} /> }} />
      <Tabs.Screen name="students" options={{ tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={24} color={color} /> }} />
      <Tabs.Screen name="staff" options={{ tabBarIcon: ({ color }) => <Ionicons name="id-card-outline" size={24} color={color} /> }} />
      <Tabs.Screen name="more" options={{ tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={24} color={color} /> }} />
    </Tabs>
  );
}
