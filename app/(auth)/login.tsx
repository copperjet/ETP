import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { ThemedText, Button, Card } from '../../components/ui';
import { useTheme } from '../../lib/theme';
import { Spacing, Radius, Typography } from '../../constants/Typography';
import { haptics } from '../../lib/haptics';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { school, setUser } = useAuthStore();
  const displayName = school?.name ?? 'Your School';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | null>(null);

  useEffect(() => {
    (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        setBiometricAvailable(true);
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('face');
        } else {
          setBiometricType('fingerprint');
        }
      }
    })();
  }, []);

  const handleBiometric = async () => {
    haptics.light();
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Sign in to ${displayName}`,
      fallbackLabel: 'Use Password',
      cancelLabel: 'Cancel',
    });
    if (result.success) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const meta = session.user.app_metadata as any;
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          fullName: session.user.user_metadata?.full_name ?? '',
          staffId: meta?.staff_id ?? null,
          parentId: meta?.parent_id ?? null,
          roles: meta?.roles ?? [],
          activeRole: meta?.active_role ?? 'hrt',
          schoolId: meta?.school_id ?? '',
        });
        haptics.success();
        router.replace('/');
      } else {
        setError('No saved session. Please sign in with your password first.');
      }
    }
  };

  const brandColor = school?.primary_color ?? '#1B2A4A';

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');

    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (err || !data.session) {
      setLoading(false);
      setError('Incorrect email or password. Try again.');
      haptics.error();
      return;
    }

    const meta = data.session.user.app_metadata as any;
    setUser({
      id: data.session.user.id,
      email: data.session.user.email ?? '',
      fullName: data.session.user.user_metadata?.full_name ?? '',
      staffId: meta?.staff_id ?? null,
      parentId: meta?.parent_id ?? null,
      roles: meta?.roles ?? [],
      activeRole: meta?.active_role ?? 'hrt',
      schoolId: meta?.school_id ?? '',
    });

    haptics.success();
    router.replace('/');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.schoolBadge, { backgroundColor: brandColor + '18' }]}>
            <View style={[styles.schoolDot, { backgroundColor: brandColor }]} />
            <ThemedText variant="label" style={{ color: brandColor }}>
              {displayName}
            </ThemedText>
          </View>

          <ThemedText variant="h2" style={styles.heading}>Welcome back</ThemedText>
          <ThemedText variant="body" color="muted" style={styles.subheading}>
            Sign in to your ETP School account
          </ThemedText>

          <View style={styles.form}>
            <View>
              <ThemedText variant="label" color="secondary" style={styles.fieldLabel}>Email address</ThemedText>
              <TextInput
                value={email}
                onChangeText={(t) => { setEmail(t); setError(''); }}
                placeholder="name@school.edu"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                style={[styles.input, Typography.body, { color: colors.textPrimary, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              />
            </View>

            <View>
              <ThemedText variant="label" color="secondary" style={styles.fieldLabel}>Password</ThemedText>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(''); }}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  style={[styles.input, styles.passwordInput, Typography.body, { color: colors.textPrimary, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                <ThemedText variant="bodySm" style={{ color: '#EF4444', marginLeft: 6, flex: 1 }}>{error}</ThemedText>
              </View>
            ) : null}

            <Button label="Sign In" onPress={handleLogin} loading={loading} fullWidth size="lg" style={styles.signInBtn} />

            <TouchableOpacity style={styles.forgotBtn}>
              <ThemedText variant="body" color="brand">Forgot password?</ThemedText>
            </TouchableOpacity>

            {biometricAvailable && (
              <TouchableOpacity style={[styles.biometricBtn, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]} onPress={handleBiometric}>
                <Ionicons
                  name={biometricType === 'face' ? 'scan-outline' : 'finger-print-outline'}
                  size={22}
                  color={colors.textSecondary}
                />
                <ThemedText variant="bodySm" color="secondary">
                  {biometricType === 'face' ? 'Sign in with Face ID' : 'Sign in with Fingerprint'}
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing['2xl'], paddingTop: Spacing.base, paddingBottom: Spacing['4xl'] },
  backBtn: { marginBottom: Spacing['2xl'], alignSelf: 'flex-start' },
  schoolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    marginBottom: Spacing.base,
    gap: Spacing.sm,
  },
  schoolDot: { width: 8, height: 8, borderRadius: 4 },
  heading: { marginBottom: Spacing.xs },
  subheading: { marginBottom: Spacing['2xl'] },
  form: { gap: Spacing.base },
  fieldLabel: { marginBottom: Spacing.xs },
  input: {
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.base,
  },
  passwordWrap: { position: 'relative' },
  passwordInput: { paddingRight: 52 },
  eyeBtn: { position: 'absolute', right: Spacing.base, top: 0, bottom: 0, justifyContent: 'center' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  signInBtn: { marginTop: Spacing.sm },
  forgotBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    marginTop: Spacing.xs,
  },
});
