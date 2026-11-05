import React, { useContext, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/common/Screen';
import { ReportList } from '../../components/common/ReportList';
import { SessionContext } from '../../session';
import type { AppSession } from '../../navigation/types';
import { pageStyles } from '../../constants/pageStyles';
import { theme } from '../../constants/theme';
import type { Report } from '../../types/report';
import { ServerReports } from './ServerReports';

type ReportsTab = 'reports' | 'local';

export function ReportsScreen(): React.JSX.Element {
  const { reports, service, online, showToast } = useContext(SessionContext) as AppSession;
  const [activeTab, setActiveTab] = useState<ReportsTab>('reports');
  const localReports = reports.filter(report => report.state !== 'uploaded');

  const retry = (report: Report) => {
    service
      .retry(report.id)
      .then(() => service.queue.run())
      .catch(error =>
        showToast(
          'error',
          'Retry unavailable',
          error instanceof Error ? error.message : 'Try again.',
        ),
      );
  };

  return (
    <Screen scroll={false} topSafeArea={false}>
      <Text style={pageStyles.title}>Reports</Text>
      <View accessibilityRole="tablist" style={styles.tabs}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'reports' }}
          onPress={() => setActiveTab('reports')}
          style={[styles.tab, activeTab === 'reports' && styles.activeTab]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'reports' && styles.activeTabText,
            ]}
          >
            Reports
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'local' }}
          onPress={() => setActiveTab('local')}
          style={[styles.tab, activeTab === 'local' && styles.activeTab]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'local' && styles.activeTabText,
            ]}
          >
            Local
            {localReports.length > 0 ? ` (${localReports.length})` : ''}
          </Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {activeTab === 'reports' ? (
          <ServerReports online={online} />
        ) : (
          <View style={styles.localContent}>
            <Text style={pageStyles.caption}>
              Saved on this device and not yet confirmed by the server. Statuses
              show whether each report is a draft, pending, uploading, retrying,
              or needs attention.
            </Text>
            <ReportList reports={localReports} retry={retry} />
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    padding: 4,
    marginTop: 4,
    marginBottom: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.line,
    gap: 4,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 11,
  },
  activeTab: {
    backgroundColor: theme.colors.primary,
    ...theme.shadow,
  },
  tabText: { color: theme.colors.muted, fontSize: 14, fontWeight: '700' },
  activeTabText: { color: theme.colors.white },
  content: { flex: 1, minHeight: 0 },
  localContent: { flex: 1, minHeight: 0 },
});
