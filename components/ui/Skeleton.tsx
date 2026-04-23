import React, { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { Radius } from '../../constants/Typography';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, radius = Radius.md, style }: SkeletonProps) {
  const { colors, scheme } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const bg = scheme === 'dark' ? colors.surfaceSecondary : colors.surfaceSecondary;

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: bg, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonRow({ lines = 2 }: { lines?: number }) {
  return (
    <View style={{ gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} height={14} />
      ))}
    </View>
  );
}
