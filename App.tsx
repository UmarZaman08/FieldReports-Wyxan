import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { SessionContext } from './src/session';
import { createReportService, startScheduling } from './src/services/runtime';
import type { ReportService } from './src/services/reports';
import type { Report } from './src/types/report';
import type { AppToast } from './src/navigation/types';
import { Screen } from './src/components/common/Screen';
import { Button } from './src/components/common/Button';

function App(): React.JSX.Element {
  const [service, setService] = useState<ReportService | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [online, setOnline] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [toast, setToast] = useState<AppToast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    let stop: (() => void) | undefined;
    let unsubscribeResults: (() => void) | undefined;
    let current: ReportService | undefined;
    const initialize = async () => {
      try {
        current = createReportService(() => {
          if (alive && current) setReports(current.repo.list());
        }, setWarning);
        unsubscribeResults = current.queue.subscribeToResults(result => {
          if (!alive) return;
          setToast({
            ...result,
            title:
              result.status === 'success'
                ? 'Report sent'
                : result.status === 'warning'
                  ? 'Upload will retry'
                  : 'Upload failed',
            id: Date.now(),
          });
        });
        await current.initialize();
        if (!alive) {
          await current.dispose();
          return;
        }
        setReports(current.repo.list());
        setService(current);
        setError(null);
        stop = startScheduling(current, setOnline, setWarning);
      } catch (failure) {
        await current?.dispose().catch(() => undefined);
        if (alive)
          setError(
            failure instanceof Error
              ? failure.message
              : 'Local storage could not be opened.',
          );
      }
    };
    initialize().catch(() => undefined);
    return () => {
      alive = false;
      stop?.();
      unsubscribeResults?.();
      if (stop) current?.dispose().catch(() => undefined);
    };
  }, [attempt]);
  const dismissToast = useCallback(() => setToast(null), []);
  const showToast = useCallback(
    (status: AppToast['status'], title: string, message: string) => {
      setToast(current => ({
        status,
        title,
        message,
        id: (current?.id ?? 0) + 1,
      }));
    },
    [],
  );
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      {service ? (
        <SessionContext.Provider value={{ service, reports, online, warning, toast, dismissToast, showToast }}>
          <AppNavigator />
        </SessionContext.Provider>
      ) : (
        <Screen>
          <Text>Field Reports</Text>
          {error ? (
            <>
              <Text accessibilityRole="alert">
                Local storage could not be initialized: {error}
              </Text>
              <Button
                label="Retry initialization"
                onPress={() => {
                  setError(null);
                  setAttempt(value => value + 1);
                }}
              />
            </>
          ) : (
            <ActivityIndicator accessibilityLabel="Opening local reports" />
          )}
        </Screen>
      )}
    </SafeAreaProvider>
  );
}
export default App;
