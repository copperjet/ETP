import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { user, isReady } = useAuthStore();

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/school-code" />;

  switch (user.activeRole) {
    case 'hrt':
      return <Redirect href="/(app)/(hrt)/home" />;
    case 'st':
      return <Redirect href="/(app)/(st)/home" />;
    case 'admin':
    case 'super_admin':
      return <Redirect href="/(app)/(admin)/home" />;
    case 'finance':
      return <Redirect href="/(app)/(finance)/home" />;
    case 'parent':
      return <Redirect href="/(app)/(parent)/home" />;
    default:
      return <Redirect href="/(auth)/school-code" />;
  }
}
