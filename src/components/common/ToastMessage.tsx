import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { theme } from '../../constants/theme';

export type ToastStatus = 'success' | 'error' | 'warning';

interface ToastMessageProps {
  status: ToastStatus;
  title: string;
  message: string;
  topOffset?: number;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}

const statusColors: Record<ToastStatus, string> = {
  success: theme.colors.success,
  error: theme.colors.danger,
  warning: theme.colors.warning,
};

export function ToastMessage({ status, title, message, topOffset = 4, actionLabel, onAction, onDismiss }: ToastMessageProps): React.JSX.Element {
  const { height } = useWindowDimensions();
  const travelDistance = height * 0.07;
  const translateY = useRef(new Animated.Value(-travelDistance)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const statusColor = statusColors[status];

  useEffect(() => {
    translateY.setValue(-travelDistance);
  }, [translateY, travelDistance]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished || cancelled) return;
      timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -travelDistance, duration: 400, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        ]).start(({ finished: dismissed }) => {
          if (dismissed && !cancelled) dismissRef.current();
        });
      }, 3000);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      translateY.stopAnimation();
      opacity.stopAnimation();
    };
  }, [opacity, translateY, travelDistance]);

  return (
    <Animated.View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.container, { top: topOffset, borderLeftColor: statusColor, opacity, transform: [{ translateY }] }]}>
      <View style={styles.logo}><Text style={styles.logoLetter}>F</Text></View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.action} hitSlop={8}>
          <Text style={[styles.actionLabel, { color: statusColor }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={onDismiss} style={styles.dismiss} hitSlop={8}>
        <Text style={styles.dismissLabel}>×</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 4, left: '5%', width: '90%', zIndex: 10, minHeight: 100, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingLeft: 14, paddingRight: 12, borderLeftWidth: 5, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, ...theme.shadow },
  logo: { width: 42, height: 42, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  logoLetter: { color: theme.colors.white, fontSize: 23, fontWeight: '800' },
  copy: { flex: 1 },
  title: { color: '#111827', fontSize: 17, lineHeight: 22, fontWeight: '800' },
  message: { color: '#5E6875', fontSize: 13, lineHeight: 18, marginTop: 4 },
  action: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 7 },
  actionLabel: { fontSize: 12, fontWeight: '800' },
  dismiss: { width: 26, height: 40, justifyContent: 'center', alignItems: 'flex-end', marginLeft: 3 },
  dismissLabel: { color: theme.colors.muted, fontSize: 22, lineHeight: 27 },
});
