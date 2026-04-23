import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { onlineManager } from '@tanstack/react-query';
import { ThemedText } from './ThemedText';
import { useTheme } from '../../lib/theme';
import { Spacing } from '../../constants/Typography';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';

const PROBE_INTERVAL_MS = 20000;
const PROBE_TIMEOUT_MS = 4000;

async function probe(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const url = (supabase as any).supabaseUrl ? `${(supabase as any).supabaseUrl}/auth/v1/health` : null;
    if (!url) { clearTimeout(timeout); return true; }
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);
    return res.ok || res.status === 401; // 401 = endpoint reachable but unauth, still "online"
  } catch {
    return false;
  }
}

export function OfflineBanner() {
  const { colors } = useTheme();
  const [online, setOnline] = useState(true);
  const slide = useRef(new Animated.Value(-40)).current;

  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      const ok = await probe();
      if (!mounted) return;
      setOnline(ok);
      onlineManager.setOnline(ok);
    };
    tick();
    const id = setInterval(tick, PROBE_INTERVAL_MS);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    Animated.spring(slide, {
      toValue: online ? -40 : 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }, [online, slide]);

  if (online) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.banner,
        {
          backgroundColor: Colors.semantic.warning,
          transform: [{ translateY: slide }],
        },
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
      <ThemedText variant="caption" style={styles.text}>
        You're offline — changes will sync when reconnected.
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 44,
    paddingBottom: Spacing.xs ?? 4,
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    zIndex: 1000,
  },
  text: { color: '#fff', fontWeight: '600' },
});
