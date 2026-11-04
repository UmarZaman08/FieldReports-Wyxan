import type { TemporaryReport } from '../types/report';

export type RootStackParamList = {
  Splash: undefined;
  Home: undefined;
  Drafts: undefined;
  CreateReport: undefined;
};

export interface AppSession {
  temporaryReports: TemporaryReport[];
  addTemporaryReport: (report: TemporaryReport) => void;
}
