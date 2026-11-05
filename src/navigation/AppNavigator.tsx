import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme } from '../constants/theme';
import { CreateReportScreen } from '../screens/Draft/CreateReportScreen';
import { DraftsScreen } from '../screens/Draft/DraftsScreen';
import { HomeScreen } from '../screens/Home/HomeScreen';
import { SplashScreen } from '../screens/Splash/SplashScreen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { navigationIcons } from '../assets/navigationIcons';
import { ReportsScreen } from '../screens/Reports/ReportsScreen';
import { SettingsScreen } from '../screens/Settings/SettingsScreen';
import type { RootStackParamList } from './types';

const navigation = createNavigationContainerRef<RootStackParamList>();
const destinations = [
  { name: 'Home', label: 'Home' },
  { name: 'Drafts', label: 'Drafts' },
  { name: 'Reports', label: 'Reports' },
  { name: 'Settings', label: 'Settings' },
] as const;
const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator(): React.JSX.Element {
  const [route, setRoute] = useState('Splash');
  return (
    <NavigationContainer
      ref={navigation}
      onReady={() => setRoute(navigation.getCurrentRoute()?.name ?? 'Splash')}
      onStateChange={() =>
        setRoute(navigation.getCurrentRoute()?.name ?? 'Splash')
      }
    >
      <View style={styles.container}>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{
            headerStyle: { backgroundColor: theme.colors.primary },
            headerTintColor: theme.colors.white,
            headerTitleStyle: { fontWeight: '700' },
            headerShadowVisible: false,
            contentStyle: styles.content,
            animation: 'fade',
          }}
        >
          <Stack.Screen
            name="Splash"
            component={SplashScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'Field Reports', headerShown: false,statusBarStyle: 'dark' }}
          />
          <Stack.Screen
            name="Drafts"
            component={DraftsScreen}
            options={{
              title: 'Drafts',
              statusBarStyle: 'light',
              headerBackVisible: false,
            }}
          />
          <Stack.Screen
            name="CreateReport"
            component={CreateReportScreen}
            options={{
              title: 'Create report',
              statusBarStyle: 'light',
              headerBackVisible: true,
              headerBackButtonDisplayMode: 'minimal',
            }}
          />
          <Stack.Screen
            name="Reports"
            component={ReportsScreen}
            options={{
              title: 'Reports',
              statusBarStyle: 'light',
              headerBackVisible: false,
            }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              title: 'Settings',
              statusBarStyle: 'light',
              headerBackVisible: false,
            }}
          />
        </Stack.Navigator>
        {route !== 'Splash' && route !== 'CreateReport' ? (
          <SafeAreaView edges={['bottom']} style={styles.bottom}>
            <View style={styles.tabs}>
              {destinations.map(item => {
                const Icon = navigationIcons[item.name];
                return (
                  <Pressable
                    key={item.name}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: route === item.name }}
                    accessibilityLabel={item.label}
                    onPress={() =>
                      navigation.reset({
                        index: 0,
                        routes: [{ name: item.name }],
                      })
                    }
                    style={[styles.tab, route === item.name && styles.selected]}
                  >
                    <Icon
                      width={23}
                      height={23}
                      stroke={
                        route === item.name ? '#FFFFFF' : theme.colors.primary
                      }
                    />
                    <Text
                      style={[
                        styles.tabText,
                        route === item.name && styles.selectedText,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </SafeAreaView>
        ) : null}
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor:theme.colors.background },
  bottom: {
    backgroundColor: theme.colors.surface,
    // borderTopLeftRadius: 28,
    // borderTopRightRadius: 28,
    borderRadius:25,
    ...theme.shadow,
    marginBottom:15,
    width:'95%',
    alignSelf:'center',
    borderWidth:0.1,
    alignContent:'center'
  },
  tabs: { flexDirection: 'row', padding: 8, gap: 5 },
  tab: {
    flex: 1,
    minHeight: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  selected: { backgroundColor: theme.colors.primary },
  tabText: { color: theme.colors.primary, fontSize: 12 },
  selectedText: { color: 'white' },
  content: { backgroundColor: theme.colors.background },
});
