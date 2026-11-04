import React, { useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import type { TemporaryReport } from './src/types/report';
import { SessionContext } from './src/session';

function App(): React.JSX.Element {
  const [temporaryReports, setTemporaryReports] = useState<TemporaryReport[]>([]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SessionContext.Provider value={{ temporaryReports, addTemporaryReport: report => setTemporaryReports(current => [report, ...current]) }}>
        <AppNavigator />
      </SessionContext.Provider>
    </SafeAreaProvider>
  );
}

export default App;
