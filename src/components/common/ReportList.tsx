import { TrashIcon, RefreshIcon } from '../../assets';
import React from 'react';
import { ReportStatus } from './ReportStatus';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Report, UploadState } from '../../types/report';
import { theme } from '../../constants/theme';
import { Button } from './Button';
export const stateLabels: Record<UploadState, string> = {
  draft: 'Draft · saved locally',
  queued: 'Pending · queued locally',
  uploading: 'Uploading',
  retry_wait: 'Waiting to retry',
  failed: 'Failed · action required',
  uploaded: 'Server confirmed',
};
export function ReportList({
  reports,
  open,
  remove,
  retry,
}: {
  reports: Report[];
  open?: (report: Report) => void;
  remove?: (report: Report) => void;
  retry?: (report: Report) => void;
}): React.JSX.Element {
  return (
    <FlatList
      style={styles.flatList}
      data={reports}
      keyExtractor={report => report.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <Text style={styles.empty}>No local reports here yet.</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Pressable
            accessibilityRole={open ? 'button' : undefined}
            disabled={!open}
            onPress={() => open?.(item)}
            style={styles.row}
          >
            {item.images[0] ? (
              <Image
                source={{ uri: item.images[0].uri }}
                style={styles.image}
              />
            ) : null}
            <View style={styles.copy}>
              <Text style={styles.title} numberOfLines={2}>
                {item.description || 'Untitled draft'}
              </Text>
              <Text style={styles.detail}>
                {new Date(item.updatedAt).toLocaleString()} ·{' '}
                {item.images.length} photos
              </Text>
              <ReportStatus state={item.state}>
                <Text
                  style={[
                    styles.state,
                    {
                      color:
                        item.state === 'failed'
                          ? theme.colors.danger
                          : item.state === 'uploaded'
                          ? theme.colors.success
                          : theme.colors.accentDark,
                    },
                  ]}
                >
                  {stateLabels[item.state]}
                </Text>
              </ReportStatus>
            </View>
            {open ? <Text style={styles.arrow}>›</Text> : null}
          </Pressable>
          {item.lastError ? (
            <Text style={styles.detail}>{item.lastError}</Text>
          ) : null}
          {item.state === 'retry_wait' && item.nextAttemptAt ? (
            <Text style={styles.detail}>
              Next eligible attempt:{' '}
              {new Date(item.nextAttemptAt).toLocaleString()}
            </Text>
          ) : null}
          {remove ? (
            <Button
              label="Delete draft"
              icon={TrashIcon}
              secondary
              onPress={() => remove(item)}
            />
          ) : null}
          {retry && item.state === 'failed' ? (
            <Button
              label="Retry upload"
              icon={RefreshIcon}
              secondary
              onPress={() => retry(item)}
            />
          ) : null}
        </View>
      )}
    />
  );
}
const styles = StyleSheet.create({
  flatList: { flex: 1 },
  list: { paddingTop: 18, paddingBottom: 24 },
  empty: { color: theme.colors.muted, textAlign: 'center', marginTop: 50 },
  card: {
    padding: 12,
    marginBottom: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.line,
    gap: 10,
    ...theme.shadow,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 80 },
  image: { width: 76, height: 76, borderRadius: 13 },
  copy: { flex: 1, gap: 6 },
  title: { color: theme.colors.ink, fontWeight: '800', fontSize: 16 },
  detail: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
  state: { fontWeight: '600', fontSize: 12 },
  arrow: { color: theme.colors.primary, fontSize: 28 },
});
