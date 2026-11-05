import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button } from '../../components/common/Button';
import { TrashIcon } from '../../assets';
import { pageStyles } from '../../constants/pageStyles';
import { theme } from '../../constants/theme';
import {
  apiErrorMessage,
  getReports,
  deleteReport,
  type ReportsEnvelope,
  type ServerReport,
} from '../../services/api/client';
import { SessionContext } from '../../session';
import type { AppSession } from '../../navigation/types';

export function ServerReports({
  online,
}: {
  online: boolean;
}): React.JSX.Element {
  const { showToast } = useContext(SessionContext) as AppSession;
  const [data, setData] = useState<ReportsEnvelope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    if (!online) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getReports(controller.signal);
      if (!controller.signal.aborted) setData(result);
    } catch (failure) {
      if (!controller.signal.aborted) setError(apiErrorMessage(failure));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [online]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const subscription = AppState.addEventListener(
        'change',
        (state: AppStateStatus) => {
          if (state === 'active') refresh();
        },
      );
      return () => {
        request.current?.abort();
        subscription.remove();
      };
    }, [refresh]),
  );

  useEffect(() => () => request.current?.abort(), []);

  const handleDelete = (report: ServerReport) => {
    Alert.alert(
      'Delete server report?',
      'Permanently delete this report and its photos from the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(report.id);
            try {
              await deleteReport(report.id);
              await refresh();
              showToast('success', 'Report deleted', 'The report was removed from the server.');
            } catch (err) {
              showToast(
                'error',
                'Delete failed',
                err instanceof Error ? err.message : 'Could not delete report.',
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <FlatList
      style={styles.server}
      data={data?.reports ?? []}
      keyExtractor={item => item.id}
      initialNumToRender={2}
      maxToRenderPerBatch={2}
      windowSize={3}
      removeClippedSubviews
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => refresh()} />
      }
      ListHeaderComponent={
        <View>
          <Text style={pageStyles.heading}>Server reports</Text>
          {!online && (
            <Text style={pageStyles.caption}>
              Offline. Connect to refresh server reports.
            </Text>
          )}
          {loading && !data && (
            <ActivityIndicator accessibilityLabel="Loading server reports" />
          )}
          {error && (
            <Text accessibilityRole="alert" style={pageStyles.caption}>
              {error}
            </Text>
          )}
        </View>
      }
      ListEmptyComponent={
        data ? (
          <Text style={pageStyles.caption}>
            No server reports.
            {!online || error || loading ? ' Last fetched result.' : ''}
          </Text>
        ) : undefined
      }
      renderItem={({ item }) => {
        const firstImage = item.images?.[0]?.url
          ? item.images[0].url.replace(/^http:\/\//i, 'https://')
          : undefined;
        return (
          <View style={styles.card}>
            <View style={styles.row}>
              {firstImage ? <ServerPhoto uri={firstImage} /> : null}
              <View style={styles.copy}>
                <Text style={styles.title} numberOfLines={2}>
                  {item.description || 'Untitled report'}
                </Text>
                <Text style={styles.detail}>
                  {new Date(item.createdAt).toLocaleString()} ·{' '}
                  {item.images?.length ?? 0} photos
                </Text>
                <Text style={styles.state}>Uploaded to server</Text>
              </View>
            </View>
            <Button
              secondary
              icon={TrashIcon}
              label={
                deletingId === item.id ? 'Deleting...' : 'Delete from server'
              }
              disabled={!online || deletingId === item.id}
              loading={deletingId === item.id}
              onPress={() => handleDelete(item)}
            />
          </View>
        );
      }}
    />
  );
}

function ServerPhoto({ uri }: { uri: string }): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.imageFrame}>
      {loading && !failed ? (
        <ActivityIndicator
          style={styles.imageLoading}
          accessibilityLabel="Loading report photo"
        />
      ) : null}
      {failed ? (
        <Text style={styles.imageError}>Photo unavailable</Text>
      ) : (
        <Image
          source={{ uri, cache: 'force-cache' }}
          style={styles.image}
          resizeMode="cover"
          resizeMethod="resize"
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => setFailed(true)}
          accessibilityLabel="First photo for this server report"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  server: { flex: 1, minHeight: 0 },
  card: {
    padding: 12,
    marginBottom: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.line,
    gap: 8,
    ...theme.shadow,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  imageFrame: {
    width: 64,
    height: 64,
    borderRadius: 13,
    backgroundColor: theme.colors.line,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageLoading: { position: 'absolute', zIndex: 1 },
  image: { width: '100%', height: '100%' },
  imageError: {
    color: theme.colors.muted,
    fontSize: 9,
    textAlign: 'center',
    padding: 4,
  },
  copy: { flex: 1, gap: 4 },
  title: { color: theme.colors.ink, fontWeight: '800', fontSize: 15 },
  detail: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
  state: { color: theme.colors.success, fontWeight: '600', fontSize: 12 },
});
