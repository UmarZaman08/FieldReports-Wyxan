import {
  CircleCheckIcon,
  CirclePlusIcon,
  ClockIcon,
  RefreshIcon,
} from '../../assets';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/common/Screen';
import { Button } from '../../components/common/Button';
import { ReportList } from '../../components/common/ReportList';
import type { AppSession, RootStackParamList } from '../../navigation/types';
import { SessionContext } from '../../session';
import { pageStyles } from '../../constants/pageStyles';
import { theme } from '../../constants/theme';
import { validateReport } from './validation';

type Props = NativeStackScreenProps<RootStackParamList, 'Drafts'>;
interface BatchProgress {
  sent: number;
  total: number;
  stage: 'checking' | 'sending' | 'queued' | 'complete';
}

export function DraftsScreen({ navigation }: Props): React.JSX.Element {
  const session = useContext(SessionContext) as AppSession;
  const [sending, setSending] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(
    null,
  );
  const batchIds = useRef(new Set<string>());
  const confirmedIds = useRef(new Set<string>());
  const batchRunning = useRef(false);
  const drafts = session.reports.filter(report => report.state === 'draft');

  useEffect(
    () =>
      session.service.queue.subscribeToConfirmations(report => {
        if (
          !batchIds.current.has(report.id) ||
          confirmedIds.current.has(report.id)
        )
          return;

        confirmedIds.current.add(report.id);
        setBatchProgress(current => {
          if (!current) return current;
          const sent = confirmedIds.current.size;
          return {
            ...current,
            sent,
            stage:
              sent >= current.total
                ? 'complete'
                : current.stage === 'queued'
                ? 'sending'
                : current.stage,
          };
        });
      }),
    [session.service],
  );

  async function sendAllDrafts(): Promise<void> {
    if (batchRunning.current || drafts.length <= 1) return;
    batchRunning.current = true;
    setSending(true);
    setBatchProgress({ sent: 0, total: drafts.length, stage: 'checking' });

    let skipped = 0;
    let queued = 0;
    try {
      const eligible = [] as typeof drafts;
      for (const draft of drafts) {
        const invalid = validateReport(draft.description, draft.images.length);
        if (invalid) {
          skipped += 1;
          continue;
        }
        try {
          for (const image of draft.images)
            await session.service.images.verify(image);
          eligible.push(draft);
        } catch {
          skipped += 1;
        }
      }

      if (eligible.length === 0) {
        setBatchProgress(null);
        Alert.alert(
          'No drafts ready to send',
          'Each report needs a description and at least one available photo.',
        );
        return;
      }

      batchIds.current = new Set(eligible.map(draft => draft.id));
      confirmedIds.current = new Set();
      setBatchProgress({
        sent: 0,
        total: eligible.length,
        stage: session.service.queue.online ? 'sending' : 'queued',
      });

      for (const draft of eligible) {
        try {
          await session.service.save(
            draft.description,
            draft.images,
            draft.id,
            true,
          );
          queued += 1;
        } catch {
          skipped += 1;
          batchIds.current.delete(draft.id);
          setBatchProgress(current =>
            current
              ? { ...current, total: Math.max(current.sent, current.total - 1) }
              : current,
          );
        }
      }

      if (queued > 0) await session.service.queue.run();
      const sent = confirmedIds.current.size;
      const stillWaiting = queued - sent;
      setBatchProgress(current =>
        current
          ? {
              ...current,
              total: sent + stillWaiting,
              stage: session.service.queue.online ? 'complete' : 'queued',
            }
          : current,
      );

      const message = session.service.queue.online
        ? `${sent} of ${sent + stillWaiting} reports confirmed by the server.${
            stillWaiting > 0
              ? ' Others remain in local upload activity for retry or review.'
              : ''
          }${skipped > 0 ? ` ${skipped} drafts need attention.` : ''}`
        : `${queued} reports queued on this device. They will send when the connection is available.${
            skipped > 0 ? ` ${skipped} drafts need attention.` : ''
          }`;
      Alert.alert(
        skipped > 0 || stillWaiting > 0
          ? 'Some drafts need attention'
          : session.service.queue.online
          ? 'All reports sent'
          : 'Drafts queued',
        message,
      );
    } catch (error) {
      Alert.alert(
        'Could not send drafts',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      batchRunning.current = false;
      setSending(false);
    }
  }

  const progressTitle = batchProgress
    ? batchProgress.stage === 'checking'
      ? 'Checking drafts'
      : batchProgress.stage === 'queued'
      ? 'Waiting for connection'
      : batchProgress.stage === 'complete' &&
        batchProgress.total > 0 &&
        batchProgress.sent === batchProgress.total
      ? 'All reports sent'
      : batchProgress.stage === 'complete'
      ? 'Send attempt finished'
      : 'Sending reports'
    : '';

  return (
    <Screen scroll={false} topSafeArea={false}>
      {batchProgress ? (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`${batchProgress.sent} of ${batchProgress.total} reports confirmed by the server`}
          accessibilityValue={{
            min: 0,
            max: Math.max(batchProgress.total, 1),
            now: batchProgress.sent,
          }}
          style={styles.progressCard}
        >
          <View style={styles.progressIcon}>
            {batchProgress.stage === 'complete' &&
            batchProgress.total > 0 &&
            batchProgress.sent === batchProgress.total ? (
              <CircleCheckIcon
                width={20}
                height={20}
                color={theme.colors.success}
                stroke={theme.colors.success}
                accessible={false}
              />
            ) : batchProgress.stage === 'queued' ? (
              <ClockIcon
                width={20}
                height={20}
                color={theme.colors.primary}
                stroke={theme.colors.primary}
                accessible={false}
              />
            ) : (
              <ActivityIndicator
                size="small"
                color={theme.colors.primary}
                accessibilityLabel="Sending reports"
              />
            )}
          </View>
          <View style={styles.progressCopy}>
            <View style={styles.progressHeading}>
              <Text style={styles.progressTitle}>{progressTitle}</Text>
              <Text style={styles.progressCount}>
                {batchProgress.sent}/{batchProgress.total}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${
                      batchProgress.total > 0
                        ? (batchProgress.sent / batchProgress.total) * 100
                        : 0
                    }%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>DRAFT WORKSPACE</Text>
          <Text style={pageStyles.caption}>
            Review and send reports from this device.
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.count}>{drafts.length}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label="Create report"
          icon={CirclePlusIcon}
          onPress={() => navigation.navigate('CreateReport')}
          disabled={sending}
          style={styles.actionButton}
        />
        {drafts.length > 1 ? (
          <Button
            label="Send all"
            icon={RefreshIcon}
            onPress={() => {
              sendAllDrafts().catch(() => undefined);
            }}
            secondary
            loading={sending}
            disabled={sending}
            style={styles.actionButton}
          />
        ) : null}
      </View>

      <ReportList
        reports={drafts}
        open={
          sending
            ? undefined
            : report =>
                navigation.navigate('CreateReport', { reportId: report.id })
        }
        remove={
          sending
            ? undefined
            : report =>
                Alert.alert(
                  'Delete draft?',
                  'This removes the local draft and its photos.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => {
                        session.service
                          .deleteDraft(report.id)
                          .catch(error =>
                            Alert.alert(
                              'Cleanup failed',
                              error instanceof Error
                                ? error.message
                                : 'Try again.',
                            ),
                          );
                      },
                    },
                  ],
                )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    marginBottom: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryTint,
  },
  progressIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
  },
  progressCopy: { flex: 1, gap: 8 },
  progressHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTitle: { color: theme.colors.ink, fontSize: 13, fontWeight: '700' },
  progressCount: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  progressTrack: {
    height: 5,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: theme.colors.surface,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: theme.colors.success,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.space.sm,
  },
  headingCopy: { flex: 1 },
  eyebrow: {
    color: theme.colors.accentDark,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  countBadge: {
    minWidth: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryTint,
    marginLeft: 12,
  },
  count: { color: theme.colors.primary, fontSize: 18, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 9, marginBottom: 4 },
  actionButton: { flex: 1, paddingHorizontal: 8 },
});
