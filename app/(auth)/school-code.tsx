import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { ThemedText, Button } from '../../components/ui';
import { useTheme } from '../../lib/theme';
import { Spacing, Radius, Typography } from '../../constants/Typography';
import { haptics } from '../../lib/haptics';

export default function SchoolCodeScreen() {
  const { colors } = useTheme();
  const { setSchool } = useAuthStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const brandAnim = useRef(new Animated.Value(0)).current;
  const [foundSchool, setFoundSchool] = useState<{ id: string; name: string; primary_color: string } | null>(null);

  const shake = () => {
    haptics.error();
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleContinue = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError('Enter your school code'); shake(); return; }

    setLoading(true);
    setError('');

    const { data, error: err } = await supabase
      .from('schools')
      .select('*')
      .eq('code', trimmed)
      .eq('subscription_status', 'active')
      .single();

    setLoading(false);

    if (err || !data) {
      setError('School not found. Check your code and try again.');
      shake();
      return;
    }

    const school = data as any;
    haptics.success();
    setSchool(school);
    setFoundSchool({ id: school.id, name: school.name, primary_color: school.primary_color ?? '#1B2A4A' });

    // Branding beat: fade in the school's brand color overlay, then navigate
    Animated.sequence([
      Animated.timing(brandAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.delay(400),
    ]).start(() => {
      router.push({ pathname: '/(auth)/login', params: { schoolId: school.id } });
      // Reset for potential back navigation
      brandAnim.setValue(0);
      setFoundSchool(null);
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Branding animation overlay */}
      {foundSchool && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: foundSchool.primary_color,
              opacity: brandAnim,
              zIndex: 99,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            },
          ]}
          pointerEvents="none"
        >
          <Image source={require('../../assets/scholr-logo.png')} style={styles.overlayLogo} resizeMode="contain" />
          <ThemedText variant="h3" style={{ color: '#fff', textAlign: 'center' }}>{foundSchool.name}</ThemedText>
        </Animated.View>
      )}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
        <View style={styles.container}>
          <View style={styles.logoArea}>
            <Image source={require('../../assets/scholr-main-logo.png')} style={styles.mainLogo} resizeMode="contain" />
            <ThemedText variant="body" color="muted" style={styles.tagline}>
              School Management, Reimagined
            </ThemedText>
          </View>

          <Animated.View style={[styles.form, { transform: [{ translateX: shakeAnim }] }]}>
            <ThemedText variant="h3" style={styles.label}>Enter your school code</ThemedText>
            <ThemedText variant="body" color="muted" style={styles.sublabel}>
              Your school administrator provides this code.
            </ThemedText>

            <TextInput
              value={code}
              onChangeText={(t) => { setCode(t); setError(''); }}
              placeholder="e.g. CIS_DEMO"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              style={[
                styles.input,
                Typography.h3,
                {
                  color: colors.textPrimary,
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: error ? '#EF4444' : colors.border,
                },
              ]}
            />

            {error ? (
              <ThemedText variant="bodySm" color="error" style={styles.error}>{error}</ThemedText>
            ) : null}

            <Button
              label="Continue"
              onPress={handleContinue}
              loading={loading}
              fullWidth
              size="lg"
              style={styles.button}
            />
          </Animated.View>

          <ThemedText variant="caption" color="muted" style={styles.footer}>
            Scholr · School Management, Reimagined
          </ThemedText>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  kav: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: Spacing['2xl'],
    justifyContent: 'center',
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
  },
  mainLogo: {
    width: 200,
    height: 67,
    marginBottom: Spacing.md,
  },
  overlayLogo: {
    width: 80,
    height: 80,
    tintColor: '#fff',
  },
  tagline: {
    textAlign: 'center',
  },
  form: {
    gap: Spacing.sm,
  },
  label: {
    marginBottom: Spacing.xs,
  },
  sublabel: {
    marginBottom: Spacing.md,
  },
  input: {
    height: 56,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.base,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  error: {
    color: '#EF4444',
    marginTop: Spacing.xs,
  },
  button: {
    marginTop: Spacing.base,
  },
  footer: {
    textAlign: 'center',
    position: 'absolute',
    bottom: Spacing.xl,
    left: 0,
    right: 0,
  },
});
