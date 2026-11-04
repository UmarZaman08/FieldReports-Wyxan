import { Platform } from 'react-native';

export const theme = {
  colors: {
    background: '#F9FAFC',
    surface: '#FFFFFF',
    ink: '#0E2645',
    muted: '#68778A',
    line: '#E5EAF0',
    primary: '#0E2645',
    primaryDark: '#091B33',
    primaryTint: '#EAF1F8',
    accent: '#6C9DD1',
    accentDark: '#447CAF',
    accentTint: '#EAF3FC',
    success: '#229B5B',
    successTint: '#E8F6EE',
    warning: '#D39A16',
    warningTint: '#FFF6DC',
    amber: '#BE1526',
    amberTint: '#FCEBED',
    danger: '#BE1526',
    white: '#FFFFFF',
  },
  space: { xs: 6, sm: 10, md: 16, lg: 22, xl: 30, xxl: 40 },
  radius: { sm: 10, md: 16, lg: 22, pill: 999 },
  shadow: Platform.select({
    ios: { shadowColor: '#0E2645', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 5 } },
    android: { elevation: 2 },
    default: {},
  }),
} as const;
