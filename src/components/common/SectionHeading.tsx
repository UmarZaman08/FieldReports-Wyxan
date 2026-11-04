import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { theme } from '../../constants/theme';

export function SectionHeading({ title, detail, style }: { title: string; detail?: string; style?: ViewStyle }): React.JSX.Element {
  return <View style={[styles.row, style]}><Text style={styles.title}>{title}</Text>{detail ? <Text style={styles.detail}>{detail}</Text> : null}</View>;
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { color: theme.colors.ink, fontSize: 18, fontWeight: '700' }, detail: { color: theme.colors.muted, fontSize: 13, fontWeight: '600' } });
