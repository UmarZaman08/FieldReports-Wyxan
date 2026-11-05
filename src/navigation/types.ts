import type { Report } from '../types/report';
import type { ReportService } from '../services/reports';
export type RootStackParamList = {
  Splash: undefined;
  Home: undefined;
  Drafts: undefined;
  CreateReport: { reportId: string } | undefined;
  Reports: undefined;
  Settings: undefined;
};
export interface AppSession {
  reports: Report[];
  service: ReportService;
  online: boolean;
  warning: string | null;
  toast: AppToast | null;
  dismissToast: () => void;
  showToast: (status: AppToast['status'], title: string, message: string) => void;
}

export interface AppToast {
  status: 'success' | 'error' | 'warning';
  title: string;
  message: string;
  id: number;
}
