import { ReportStatus } from '../../components/common/ReportStatus';
import React, { useContext } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/common/Screen';
import { Button } from '../../components/common/Button';
import { stateLabels } from '../../components/common/ReportList';
import { theme } from '../../constants/theme';
import type { AppSession, RootStackParamList } from '../../navigation/types';
import { SessionContext } from '../../session';
import {
  FileTextIcon,
  CircleExclamationIcon,
  ChartColumnIcon,
  ImagesIcon,
  ClockIcon,
  RefreshIcon,
  CirclePlusIcon,
} from '../../assets';
type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
export function HomeScreen({ navigation }: Props): React.JSX.Element {
  const { reports, online, warning } = useContext(SessionContext) as AppSession;
  const counts = [
    {
      label: 'Drafts',
      icon: FileTextIcon,
      count: reports.filter(r => r.state === 'draft').length,
      color: '#E0EFFE',
      route: 'Drafts' as const,
    },
    {
      label: 'Photos',
      icon: ImagesIcon,
      count: reports.reduce((total, report) => total + report.images.length, 0),
      color: '#DFF7E9',
      route: 'Drafts' as const,
    },
    {
      label: 'Failed',
      icon: CircleExclamationIcon,
      count: reports.filter(r => r.state === 'failed').length,
      color: '#FBE4E7',
      route: 'Reports' as const,
    },
    {
      label: 'Total',
      icon: ChartColumnIcon,
      count: reports.length,
      color: '#E8EDF4',
      route: 'Reports' as const,
    },
    {
      label: 'Pending',
      icon: ClockIcon,
      count: reports.filter(
        r => r.state === 'queued' || r.state === 'retry_wait',
      ).length,
      color: '#FFF3D7',
      route: 'Reports' as const,
    },
    {
      label: 'Uploading',
      icon: RefreshIcon,
      count: reports.filter(r => r.state === 'uploading').length,
      color: '#E0EFFE',
      route: 'Reports' as const,
    },
  ];
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello,{'\n'}Field Inspector 👋</Text>
        <Text style={styles.network}>
          {online ? 'Online' : 'Offline'}
          {'\n'}Saved on device
        </Text>
      </View>
      <View style={styles.grid}>
        {counts.map(item => (
          <Pressable
            accessibilityRole="button"
            key={item.label}
            onPress={() => navigation.navigate(item.route)}
            style={[styles.stat, { backgroundColor: item.color }]}
          >
            <item.icon
              width={22}
              height={22}
              style={styles.statIcon}
              accessible={false}
            />
            <Text style={styles.value}>{item.count}</Text>
            <Text style={styles.label}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <Button
        label="Create Report"
        icon={CirclePlusIcon}
        onPress={() => navigation.navigate('CreateReport')}
      />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent activity</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Reports')}
        >
          <Text style={styles.link}>View all →</Text>
        </Pressable>
      </View>
      {reports.length === 0 ? (
        <Text style={styles.notice}>
          No saved reports yet. Create a report to get started.
        </Text>
      ) : (
        reports.slice(0, 5).map(report => (
          <Pressable
            key={report.id}
            accessibilityRole="button"
            onPress={() =>
              report.state === 'draft'
                ? navigation.navigate('CreateReport', { reportId: report.id })
                : navigation.navigate('Reports')
            }
            style={styles.recent}
          >
            {report.images[0] ? (
              <Image
                source={{ uri: report.images[0].uri }}
                style={styles.thumb}
              />
            ) : null}
            <View style={styles.copy}>
              <Text numberOfLines={1} style={styles.label}>
                {report.description || 'Untitled draft'}
              </Text>
              <Text style={styles.small}>
                {new Date(report.updatedAt).toLocaleDateString()}
              </Text>
              <ReportStatus state={report.state}>
                <Text style={styles.small}>{stateLabels[report.state]}</Text>
              </ReportStatus>
            </View>
            <Text>›</Text>
          </Pressable>
        ))
      )}
      <Text style={styles.notice}>
        Pending includes queued reports and reports waiting to retry. After the
        server confirms an upload, its local report and photos are removed.
      </Text>
      {warning ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {warning}
        </Text>
      ) : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.primary,
    margin: -22,
    marginBottom: 20,
    padding: 24,
    paddingTop: 34,
    paddingBottom: 34,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: { color: 'white', fontSize: 25, lineHeight: 32, fontWeight: '800' },
  network: {
    color: '#D9E8F8',
    textAlign: 'right',
    fontSize: 11,
    lineHeight: 18,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    padding: 18,
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'white',
    ...theme.shadow,
  },
  statIcon: { position: 'absolute', top: 12, left: 12 },
  value: { color: theme.colors.ink, fontSize: 30, fontWeight: '800' },
  label: { color: theme.colors.ink, fontSize: 14, fontWeight: '700' },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 26,
    marginBottom: 14,
  },
  sectionTitle: { color: theme.colors.ink, fontSize: 18, fontWeight: '800' },
  link: { color: theme.colors.primary, fontSize: 12, fontWeight: '600' },
  recent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
  },
  thumb: { width: 58, height: 58, borderRadius: 10 },
  copy: { flex: 1, gap: 5 },
  small: { color: theme.colors.muted, fontSize: 12 },
  notice: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 18,
    marginBottom: 12,
  },
});
