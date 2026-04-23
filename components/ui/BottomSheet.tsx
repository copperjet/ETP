import React, { useEffect, useRef } from 'react';
import {
  View,
  Modal,
  Animated,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  ViewStyle,
  PanResponder,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../lib/theme';
import { Radius, Spacing } from '../../constants/Typography';
import { ThemedText } from './ThemedText';

const { height: SCREEN_H } = Dimensions.get('window');

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapHeight?: number;
}

export function BottomSheet({ visible, onClose, title, children, snapHeight = SCREEN_H * 0.55 }: BottomSheetProps) {
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(snapHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 180 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: snapHeight, duration: 260, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.8) {
          onClose();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20 }).start();
        }
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            height: snapHeight,
            transform: [{ translateY }],
          },
        ]}
      >
        <View {...panResponder.panHandlers} style={styles.handle}>
          <View style={[styles.pill, { backgroundColor: colors.border }]} />
          {title && (
            <ThemedText variant="h4" style={styles.title}>{title}</ThemedText>
          )}
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow: 'hidden',
  },
  handle: {
    alignItems: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  pill: {
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.sm,
  },
  title: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.base,
  },
  contentInner: {
    paddingBottom: Spacing.xl,
  },
});
