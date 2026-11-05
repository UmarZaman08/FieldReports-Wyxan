import React, { PropsWithChildren, useContext } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { SessionContext } from '../../session';
import { ToastMessage } from './ToastMessage';

interface ScreenProps extends PropsWithChildren {
  scroll?: boolean;
  topSafeArea?: boolean;
}

export function Screen({
  children,
  scroll = true,
  topSafeArea = true,
}: ScreenProps): React.JSX.Element {
  const session = useContext(SessionContext);
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView
      style={styles.safe}
      edges={topSafeArea ? ['top', 'left', 'right'] : ['left', 'right']}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
      {session?.toast ? (
        <ToastMessage
          key={session.toast.id}
          status={session.toast.status}
          title={session.toast.title}
          message={session.toast.message}
          topOffset={topSafeArea ? insets.top + 4 : 4}
          onDismiss={session.dismissToast}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background, position: 'relative' },
  content: {
    padding: theme.space.lg,
    paddingBottom: theme.space.xxl,
    flexGrow: 1,
  },
});
