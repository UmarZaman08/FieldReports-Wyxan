import { createContext } from 'react';
import type { AppSession } from './navigation/types';

export const SessionContext = createContext<AppSession | null>(null);
