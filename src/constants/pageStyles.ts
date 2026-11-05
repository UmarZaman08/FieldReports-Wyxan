import { StyleSheet } from 'react-native';
import { theme } from './theme';
export const pageStyles = StyleSheet.create({
  title: {
    color: theme.colors.ink,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  caption: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  heading: {
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: '700',
    marginVertical: 16,
  },
  notice: {
    backgroundColor: theme.colors.primaryTint,
    color: theme.colors.ink,
    padding: 14,
    borderRadius: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
});
