import React from 'react';
import { View, Image, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { ThemedText } from './ThemedText';

interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: number;
  style?: ViewStyle;
}

function initials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function stringToColor(str: string) {
  const palette = ['#6366F1','#8B5CF6','#EC4899','#F59E0B','#10B981','#3B82F6','#EF4444','#14B8A6'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

export function Avatar({ name, photoUrl, size = 40, style }: AvatarProps) {
  const bg = stringToColor(name);
  const fontSize = Math.round(size * 0.38);

  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style as ImageStyle]}
      />
    );
  }

  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        styles.fallback,
        style,
      ]}
    >
      <ThemedText style={{ color: '#fff', fontSize, fontWeight: '700', lineHeight: fontSize * 1.2 }}>
        {initials(name)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
