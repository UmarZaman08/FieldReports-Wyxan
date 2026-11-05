import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  FileTextIcon,
  ClockIcon,
  RefreshIcon,
  CircleCheckIcon,
  CircleExclamationIcon,
} from '../../assets';
import type { UploadState } from '../../types/report';

const icons = {
  draft: FileTextIcon,
  queued: ClockIcon,
  uploading: RefreshIcon,
  retry_wait: ClockIcon,
  failed: CircleExclamationIcon,
  uploaded: CircleCheckIcon,
};
export function ReportStatus({
  state,
  children,
}: {
  state: UploadState;
  children: React.ReactNode;
}): React.JSX.Element {
  const Icon = icons[state];
  return (
    <View style={styles.row}>
      <Icon width={14} height={14} accessible={false} />
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
