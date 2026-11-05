import 'react-native-get-random-values';
import { v4 as uuid } from 'uuid';
import { open } from '@op-engineering/op-sqlite';
import BlobUtil from 'react-native-blob-util';
import NetInfo from '@react-native-community/netinfo';
import BackgroundFetch from 'react-native-background-fetch';
import { AppState, Platform } from 'react-native';
import { ReportRepository } from '../database/repository';
import { ImageStorage } from './image/storage';
import { ReportService } from './reports';
import { HttpUploadTransport } from './upload/transport';
import type { UploadTransport } from './upload/coordinator';

export function createReportService(
  changed: () => void,
  warning: (message: string) => void,
  transport: UploadTransport = new HttpUploadTransport(),
): ReportService {
  const db = open({ name: 'field-reports.sqlite' });
  return new ReportService(
    new ReportRepository(db, changed),
    new ImageStorage(
      BlobUtil.fs,
      `${BlobUtil.fs.dirs.DocumentDir}/report-images`,
    ),
    uuid,
    transport,
    warning,
    () => db.close(),
  );
}

export function startScheduling(
  service: ReportService,
  network: (online: boolean) => void,
  warning: (message: string) => void,
): () => void {
  let stopped = false;
  let foreground = AppState.currentState === 'active';
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let run = () => {};
  const clearRetryTimer = () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = undefined;
  };
  const scheduleNextRetry = () => {
    clearRetryTimer();
    if (stopped || !foreground || !service.queue.online) return;
    const nextAttemptAt = service.repo
      .list()
      .filter(
        report =>
          report.state === 'retry_wait' && report.nextAttemptAt !== null,
      );
    const dueAt = nextAttemptAt.reduce(
      (earliest, report) =>
        Math.min(earliest, report.nextAttemptAt ?? Number.POSITIVE_INFINITY),
      Number.POSITIVE_INFINITY,
    );
    if (Number.isFinite(dueAt))
      retryTimer = setTimeout(run, Math.max(0, dueAt - Date.now()));
  };
  run = () => {
    service.queue
      .run()
      .catch(error =>
        warning(
          error instanceof Error
            ? error.message
            : 'Upload processing unavailable.',
        ),
      )
      .finally(scheduleNextRetry);
  };
  const unsubscribe = NetInfo.addEventListener(state => {
    service.queue.online =
      state.isConnected === true && state.isInternetReachable !== false;
    network(service.queue.online);
    if (foreground) run();
  });
  const app = AppState.addEventListener('change', state => {
    foreground = state === 'active';
    if (foreground) {
      service.queue.resume();
      run();
    } else {
      clearRetryTimer();
      service.queue
        .suspend()
        .catch(() => warning('Could not suspend uploads.'));
    }
  });
  // Real transport is now configured, enabling foreground & Android background scheduling.
  // Android autolinks this library. iOS requires the capabilities documented in PHASE_02.md.
  if (service.queue.configured && Platform.OS === 'android') {
    BackgroundFetch.configure(
      {
        minimumFetchInterval: 15,
        stopOnTerminate: true,
        startOnBoot: false,
        enableHeadless: false,
      },
      taskId => {
        service.queue.resume();
        service.queue
          .run()
          .catch(() => warning('Background upload processing failed.'))
          .finally(() => {
            scheduleNextRetry();
            if (!foreground) service.queue.suspend().catch(() => undefined);
            BackgroundFetch.finish(taskId);
          });
      },
      taskId => {
        service.queue.suspend().catch(() => undefined);
        BackgroundFetch.finish(taskId);
      },
    )
      .then(() => {
        if (stopped) BackgroundFetch.stop().catch(() => undefined);
      })
      .catch(() =>
        warning(
          'Background scheduling unavailable. Foreground recovery remains available.',
        ),
      );
  }
  return () => {
    stopped = true;
    unsubscribe();
    app.remove();
    clearRetryTimer();
    service.queue.suspend().catch(() => undefined);
    if (service.queue.configured && Platform.OS === 'android')
      BackgroundFetch.stop().catch(() => undefined);
  };
}
