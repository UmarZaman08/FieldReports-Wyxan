import React, { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/common/Screen';
import { SectionHeading } from '../../components/common/SectionHeading';
import { theme } from '../../constants/theme';
import type { AppSession, RootStackParamList } from '../../navigation/types';
import { SessionContext } from '../../session';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props): React.JSX.Element {
  const session = useContext(SessionContext) as AppSession;
  const reports = session.temporaryReports;
  const photoCount = reports.reduce((total, report) => total + report.images.length, 0);
  const latestReport = reports[0];

  return (
    <Screen>
      <View style={styles.topBar}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>F</Text></View>
        <View style={styles.topBarCopy}><Text style={styles.brandName}>FIELD REPORTS</Text><Text style={styles.brandCaption}>INSPECTOR WORKSPACE</Text></View>
        <View style={styles.sessionTag}><View style={styles.sessionDot} /><Text style={styles.sessionText}>ON DEVICE</Text></View>
      </View>

      <View style={styles.headingRow}>
        <View style={styles.headingCopy}><Text style={styles.eyebrow}>FIELD OVERVIEW</Text><Text style={styles.title}>Make every{ '\n' }detail count.</Text></View>
        <View style={styles.headingIcon}><Text style={styles.headingIconText}>⌖</Text></View>
      </View>
      <Text style={styles.intro}>Create clear, photo-backed notes from your site visits.</Text>

      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, styles.summaryCardBlue]}>
          <View style={styles.cardTop}><View style={styles.cardIcon}><Text style={styles.cardIconText}>▤</Text></View><Text style={styles.cardMark}>01</Text></View>
          <Text style={styles.summaryValue}>{reports.length}</Text><Text style={styles.summaryLabel}>Temporary reports</Text><Text style={styles.summaryCaption}>This app session</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardPlain]}>
          <View style={styles.cardTop}><View style={[styles.cardIcon, styles.cardIconBlue]}><Text style={[styles.cardIconText, styles.cardIconBlueText]}>▧</Text></View><Text style={styles.cardMark}>02</Text></View>
          <Text style={styles.summaryValue}>{photoCount}</Text><Text style={styles.summaryLabel}>Photos attached</Text><Text style={styles.summaryCaption}>Across temporary reports</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardPlain]}>
          <View style={styles.cardTop}><View style={[styles.cardIcon, styles.cardIconRed]}><Text style={[styles.cardIconText, styles.cardIconRedText]}>◷</Text></View><Text style={styles.cardMark}>03</Text></View>
          <Text style={styles.summaryValueSmall}>Session only</Text><Text style={styles.summaryLabel}>Report storage</Text><Text style={styles.summaryCaption}>Local saving is not enabled</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardNavy]}>
          <View style={styles.cardTop}><View style={[styles.cardIcon, styles.cardIconNavy]}><Text style={styles.cardIconTextNavy}>↑</Text></View><Text style={styles.cardMarkLight}>04</Text></View>
          <Text style={styles.summaryValueLight}>Unavailable</Text><Text style={styles.summaryLabelLight}>Report uploads</Text><Text style={styles.summaryCaptionLight}>No server connection in Phase 01</Text>
        </View>
      </View>

      <SectionHeading title="Quick actions" detail="GET STARTED" style={styles.section} />
      <View style={styles.quickActions}>
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate('CreateReport')} style={({ pressed }) => [styles.quickCard, styles.quickCardPrimary, pressed && styles.pressed]}>
          <View style={styles.quickIconPrimary}><Text style={styles.quickIconTextPrimary}>＋</Text></View><Text style={styles.quickTitlePrimary}>Create report</Text><Text style={styles.quickCaptionPrimary}>Start a site note</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Drafts')} style={({ pressed }) => [styles.quickCard, styles.quickCardSecondary, pressed && styles.pressed]}>
          <View style={styles.quickIconSecondary}><Text style={styles.quickIconTextSecondary}>▤</Text></View><Text style={styles.quickTitleSecondary}>View drafts</Text><Text style={styles.quickCaptionSecondary}>{reports.length ? `${reports.length} this session` : 'Your report workspace'}</Text>
        </Pressable>
      </View>

      <View style={styles.recentHeading}><Text style={styles.recentSectionTitle}>Recent reports</Text>{reports.length > 0 ? <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Drafts')} hitSlop={8}><Text style={styles.viewAll}>View all</Text></Pressable> : null}</View>
      {latestReport ? (
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Drafts')} style={({ pressed }) => [styles.recentCard, pressed && styles.pressed]}>
          <View style={styles.recentIcon}><Text style={styles.recentIconText}>▤</Text></View><View style={styles.recentCopy}><Text style={styles.recentTitle} numberOfLines={1}>{latestReport.description}</Text><Text style={styles.recentCaption}>{latestReport.images.length} {latestReport.images.length === 1 ? 'photo' : 'photos'} · Temporary in this session</Text></View><Text style={styles.recentArrow}>›</Text>
        </Pressable>
      ) : (
        <View style={styles.emptyRecent}><View style={styles.emptyRecentIcon}><Text style={styles.emptyRecentGlyph}>⌑</Text></View><View style={styles.emptyRecentCopy}><Text style={styles.emptyRecentTitle}>No reports in this session</Text><Text style={styles.emptyRecentText}>Create a temporary report to see it here.</Text></View></View>
      )}
      <View style={styles.phaseNote}><View style={styles.phaseNoteBar} /><Text style={styles.phaseNoteText}>Temporary selections clear when you close the app. They are not yet saved or uploaded.</Text></View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', marginTop: 2, marginBottom: 24 }, brandMark: { width: 40, height: 40, borderRadius: 13, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }, brandMarkText: { color: theme.colors.white, fontSize: 21, fontWeight: '800' }, topBarCopy: { marginLeft: 10, flex: 1 }, brandName: { color: theme.colors.ink, fontSize: 12, fontWeight: '800', letterSpacing: 1.15 }, brandCaption: { color: theme.colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 3 }, sessionTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.pill, paddingHorizontal: 10, paddingVertical: 8 }, sessionDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.accent, marginRight: 6 }, sessionText: { color: theme.colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headingCopy: { flex: 1 }, eyebrow: { color: theme.colors.accentDark, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 7 }, title: { color: theme.colors.ink, fontSize: 31, lineHeight: 35, fontWeight: '800', letterSpacing: -0.7 }, headingIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: theme.colors.accentTint, alignItems: 'center', justifyContent: 'center', marginRight: 4 }, headingIconText: { color: theme.colors.accentDark, fontSize: 30 }, intro: { color: theme.colors.muted, fontSize: 13, lineHeight: 19, marginTop: 9, marginBottom: 19 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 }, summaryCard: { width: '48.2%', minHeight: 150, borderRadius: theme.radius.lg, padding: 14, ...theme.shadow }, summaryCardBlue: { backgroundColor: '#EAF3FC' }, summaryCardPlain: { backgroundColor: theme.colors.surface }, summaryCardNavy: { backgroundColor: theme.colors.primary }, cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, cardIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: theme.colors.white, alignItems: 'center', justifyContent: 'center' }, cardIconBlue: { backgroundColor: theme.colors.accentTint }, cardIconRed: { backgroundColor: theme.colors.amberTint }, cardIconNavy: { backgroundColor: 'rgba(255,255,255,0.13)' }, cardIconText: { color: theme.colors.ink, fontSize: 17, fontWeight: '700' }, cardIconBlueText: { color: theme.colors.accentDark }, cardIconRedText: { color: theme.colors.danger }, cardIconTextNavy: { color: theme.colors.white, fontSize: 18, fontWeight: '700' }, cardMark: { color: '#9AAABD', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 }, cardMarkLight: { color: '#AABBCD', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 }, summaryValue: { color: theme.colors.ink, fontSize: 29, fontWeight: '800', marginTop: 13, letterSpacing: -0.7 }, summaryValueSmall: { color: theme.colors.ink, fontSize: 19, fontWeight: '800', marginTop: 18 }, summaryValueLight: { color: theme.colors.white, fontSize: 19, fontWeight: '800', marginTop: 18 }, summaryLabel: { color: theme.colors.ink, fontSize: 12, fontWeight: '700', marginTop: 2 }, summaryLabelLight: { color: theme.colors.white, fontSize: 12, fontWeight: '700', marginTop: 2 }, summaryCaption: { color: theme.colors.muted, fontSize: 10, marginTop: 4 }, summaryCaptionLight: { color: '#D1DDE9', fontSize: 10, marginTop: 4 },
  section: { marginTop: 25, marginBottom: 12 }, quickActions: { flexDirection: 'row', gap: 11 }, quickCard: { flex: 1, borderRadius: theme.radius.lg, minHeight: 116, padding: 13, justifyContent: 'flex-end' }, quickCardPrimary: { backgroundColor: theme.colors.primary }, quickCardSecondary: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line }, quickIconPrimary: { position: 'absolute', top: 12, left: 12, width: 31, height: 31, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }, quickIconSecondary: { position: 'absolute', top: 12, left: 12, width: 31, height: 31, borderRadius: 11, backgroundColor: theme.colors.accentTint, alignItems: 'center', justifyContent: 'center' }, quickIconTextPrimary: { color: theme.colors.white, fontSize: 22, lineHeight: 25 }, quickIconTextSecondary: { color: theme.colors.accentDark, fontSize: 16 }, quickTitlePrimary: { color: theme.colors.white, fontSize: 14, fontWeight: '700' }, quickTitleSecondary: { color: theme.colors.ink, fontSize: 14, fontWeight: '700' }, quickCaptionPrimary: { color: '#D1DDE9', fontSize: 10, marginTop: 3 }, quickCaptionSecondary: { color: theme.colors.muted, fontSize: 10, marginTop: 3 }, recentHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25, marginBottom: 12 }, recentSectionTitle: { color: theme.colors.ink, fontSize: 18, fontWeight: '700' }, viewAll: { color: theme.colors.accentDark, fontSize: 12, fontWeight: '700' },
  recentCard: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.lg }, recentIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: theme.colors.accentTint, alignItems: 'center', justifyContent: 'center' }, recentIconText: { color: theme.colors.accentDark, fontSize: 18 }, recentCopy: { flex: 1, marginLeft: 11 }, recentTitle: { color: theme.colors.ink, fontSize: 13, fontWeight: '700' }, recentCaption: { color: theme.colors.muted, fontSize: 10, marginTop: 4 }, recentArrow: { color: theme.colors.muted, fontSize: 24, marginLeft: 7 }, emptyRecent: { flexDirection: 'row', alignItems: 'center', padding: 13, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.lg }, emptyRecentIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }, emptyRecentGlyph: { color: theme.colors.muted, fontSize: 21 }, emptyRecentCopy: { flex: 1, marginLeft: 11 }, emptyRecentTitle: { color: theme.colors.ink, fontSize: 12, fontWeight: '700' }, emptyRecentText: { color: theme.colors.muted, fontSize: 10, marginTop: 4 }, phaseNote: { flexDirection: 'row', alignItems: 'center', marginTop: 17, marginBottom: 5 }, phaseNoteBar: { width: 3, height: 28, borderRadius: 2, backgroundColor: theme.colors.danger, marginRight: 9 }, phaseNoteText: { flex: 1, color: theme.colors.muted, fontSize: 10, lineHeight: 15 }, pressed: { opacity: 0.72 },
});
