import React, { useContext, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { SvgProps } from 'react-native-svg';
import packageInfo from '../../../package.json';
import {
  CircleExclamationIcon,
  ClockIcon,
  FileTextIcon,
  TrashIcon,
} from '../../assets';
import { Screen } from '../../components/common/Screen';
import { pageStyles } from '../../constants/pageStyles';
import { theme } from '../../constants/theme';
import type { AppSession } from '../../navigation/types';
import { SessionContext } from '../../session';
import { deleteAllServerReports } from '../../services/api/client';

interface SummaryRowProps {
  icon: React.ComponentType<SvgProps>;
  label: string;
  value: string;
  tint?: string;
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  tint = theme.colors.primaryTint,
}: SummaryRowProps): React.JSX.Element {
  return (
    <View style={styles.summaryRow}>
      <View style={[styles.rowIcon, { backgroundColor: tint }]}>
        <Icon
          width={18}
          height={18}
          color={theme.colors.primary}
          stroke={theme.colors.primary}
          accessible={false}
        />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function SettingsScreen(): React.JSX.Element {
  const { reports, service, warning, online, showToast } = useContext(
    SessionContext,
  ) as AppSession;
  const [resetting, setResetting] = useState(false);
  const [deletingServer, setDeletingServer] = useState(false);

  const summary = useMemo(() => {
    const photoBytes = reports.reduce(
      (total, report) =>
        total + report.images.reduce((sum, image) => sum + image.size, 0),
      0,
    );
    return {
      waiting: reports.filter(
        report => report.state === 'queued' || report.state === 'retry_wait',
      ).length,
      failed: reports.filter(report => report.state === 'failed').length,
      photoMegabytes: (photoBytes / (1024 * 1024)).toFixed(1),
    };
  }, [reports]);

  const resetLocalData = () => {
    Alert.alert(
      'Clear local data?',
      'This permanently deletes reports stored only on this device—including drafts, reports waiting to send, and reports needing attention—plus their photos. Reports already on the server will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear local data',
          style: 'destructive',
          onPress: () => {
            setResetting(true);
            service
              .reset()
              .then(() =>
                showToast('success', 'Local data cleared', 'Reports and photos were removed from this device.'),
              )
              .catch(error =>
                showToast(
                  'error',
                  'Could not clear local data',
                  error instanceof Error ? error.message : 'Please try again.',
                ),
              )
              .finally(() => setResetting(false));
          },
        },
      ],
    );
  };

  const confirmDeleteServerReports = () => {
    if (!online) {
      showToast('warning', 'You’re offline', 'Connect to the internet and try again.');
      return;
    }
    Alert.alert(
      'Delete all server reports?',
      'This permanently deletes every report currently listed by the server and its photos. This cannot be undone. Local drafts and pending reports stay on this device and may upload later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all server reports',
          style: 'destructive',
          onPress: () => {
            setDeletingServer(true);
            deleteAllServerReports(new AbortController().signal)
              .then(({ deletedCount }) =>
                showToast(
                  'success',
                  'Server reports deleted',
                  `${deletedCount} report${
                    deletedCount === 1 ? '' : 's'
                  } deleted from the server.`,
                ),
              )
              .catch(error =>
                showToast(
                  'error',
                  'Could not delete all server reports',
                  error instanceof Error
                    ? error.message
                    : 'Please check the connection and try again.',
                ),
              )
              .finally(() => setDeletingServer(false));
          },
        },
      ],
    );
  };

  return (
    <Screen topSafeArea={false}>
      <Text style={pageStyles.title}>Settings</Text>

      <View style={styles.connectionCard}>
        <View style={styles.connectionCopy}>
          <Text style={styles.cardEyebrow}>CONNECTION</Text>
          <Text style={styles.cardTitle}>
            {online ? 'You’re online' : 'You’re offline'}
          </Text>
        </View>
        <View
          style={[
            styles.connectionBadge,
            online ? styles.onlineBadge : styles.offlineBadge,
          ]}
        >
          <View
            style={[
              styles.connectionDot,
              online ? styles.onlineDot : styles.offlineDot,
            ]}
          />
          <Text
            style={[
              styles.connectionText,
              online ? styles.onlineText : styles.offlineText,
            ]}
          >
            {online ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Local data</Text>
        <SummaryRow
          icon={FileTextIcon}
          label="Reports saved on this device"
          value={String(reports.length)}
        />
        <SummaryRow
          icon={ClockIcon}
          label="Waiting to send"
          value={String(summary.waiting)}
          tint={theme.colors.warningTint}
        />
        <SummaryRow
          icon={CircleExclamationIcon}
          label="Needs attention"
          value={String(summary.failed)}
          tint={theme.colors.amberTint}
        />
        <View style={styles.storageLine}>
          <Text style={styles.storageLabel}>Photo storage</Text>
          <Text style={styles.storageValue}>{summary.photoMegabytes} MB</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Server data</Text>
        <Text style={styles.serverDescription}>
          Permanently remove reports and photos currently stored on the server.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete all server reports"
          disabled={!online || deletingServer}
          onPress={confirmDeleteServerReports}
          style={({ pressed }) => [
            styles.clearButton,
            pressed && styles.pressed,
            (!online || deletingServer) && styles.disabled,
          ]}
        >
          {deletingServer ? (
            <ActivityIndicator color={theme.colors.danger} />
          ) : (
            <TrashIcon
              width={19}
              height={19}
              color={theme.colors.danger}
              stroke={theme.colors.danger}
              accessible={false}
            />
          )}
          <Text style={styles.clearButtonText}>
            {deletingServer
              ? 'Deleting server reports…'
              : 'Delete all server reports'}
          </Text>
        </Pressable>
        {!online ? (
          <Text style={styles.offlineHint}>
            Connect to delete server reports.
          </Text>
        ) : null}
      </View>


      {warning ? (
        <Text accessibilityRole="alert" style={styles.warning}>
          {warning}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Clear local data"
        disabled={resetting}
        onPress={resetLocalData}
        style={({ pressed }) => [
          styles.clearButton,
          pressed && styles.pressed,
          resetting && styles.disabled,
        ]}
      >
        {resetting ? (
          <ActivityIndicator color={theme.colors.danger} />
        ) : (
          <TrashIcon
            width={19}
            height={19}
            color={theme.colors.danger}
            stroke={theme.colors.danger}
            accessible={false}
          />
        )}
        <Text style={styles.clearButtonText}>
          {resetting ? 'Clearing local data…' : 'Clear local data'}
        </Text>
      </Pressable>

       <View style={styles.aboutCard}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.aboutRow}>
          <View style={styles.appMark}>
            <Text style={styles.appMarkText}>F</Text>
          </View>
          <View style={styles.aboutCopy}>
            <Text style={styles.appName}>FieldReports</Text>
            <Text style={styles.version}>Version {packageInfo.version}</Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  connectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    marginTop: 4,
    marginBottom: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
  },
  connectionCopy: { gap: 5 },
  cardEyebrow: {
    color: '#C6D5E5',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  cardTitle: { color: theme.colors.white, fontSize: 18, fontWeight: '700' },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
  },
  onlineBadge: { backgroundColor: '#E8F6EE' },
  offlineBadge: { backgroundColor: '#FFF6DC' },
  connectionDot: { width: 7, height: 7, borderRadius: 4 },
  onlineDot: { backgroundColor: theme.colors.success },
  offlineDot: { backgroundColor: theme.colors.warning },
  connectionText: { fontSize: 12, fontWeight: '700' },
  onlineText: { color: theme.colors.success },
  offlineText: { color: theme.colors.warning },
  card: {
    padding: 17,
    marginBottom: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
    ...theme.shadow,
  },
  aboutCard: {
    padding: 17,
    marginVertical: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
    ...theme.shadow,
  },
  sectionTitle: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  summaryRow: {
    minHeight: 49,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  rowLabel: { flex: 1, color: theme.colors.muted, fontSize: 13 },
  rowValue: { color: theme.colors.ink, fontSize: 14, fontWeight: '700' },
  storageLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 13,
  },
  storageLabel: { color: theme.colors.muted, fontSize: 13 },
  storageValue: { color: theme.colors.ink, fontSize: 13, fontWeight: '700' },
  aboutRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  appMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appMarkText: { color: theme.colors.white, fontSize: 21, fontWeight: '800' },
  aboutCopy: { gap: 3 },
  serverDescription: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 13,
  },
  offlineHint: { color: theme.colors.muted, fontSize: 12, marginTop: 9 },
  appName: { color: theme.colors.ink, fontSize: 14, fontWeight: '700' },
  version: { color: theme.colors.muted, fontSize: 12 },
  warning: {
    marginBottom: 12,
    color: theme.colors.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  clearButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#F0C7CC',
    backgroundColor: theme.colors.surface,
  },
  clearButtonText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.6 },
});
