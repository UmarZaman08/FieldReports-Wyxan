import React from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme } from '../constants/theme';
import { CreateReportScreen } from '../screens/Draft/CreateReportScreen';
import { DraftsScreen } from '../screens/Draft/DraftsScreen';
import { HomeScreen } from '../screens/Home/HomeScreen';
import { SplashScreen } from '../screens/Splash/SplashScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.ink,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: styles.content,
          animation: 'fade',
        }}>
        <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Field Reports', headerShown: false }} />
        <Stack.Screen name="Drafts" component={DraftsScreen} options={{ title: 'Drafts' }} />
        <Stack.Screen name="CreateReport" component={CreateReportScreen} options={{ title: 'Create report' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({ content: { backgroundColor: theme.colors.background } });
