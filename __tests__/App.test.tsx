import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('../src/services/runtime', () => ({
  createReportService: jest.fn(() => {
    throw new Error('Database unavailable');
  }),
  startScheduling: jest.fn(),
}));
jest.mock('../src/navigation/AppNavigator', () => ({
  AppNavigator: () => null,
}));

test(
  'shows an actionable storage error instead of opening an unsafe session',
  async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    expect(JSON.stringify(renderer!.toJSON())).toContain('Database unavailable');
    expect(JSON.stringify(renderer!.toJSON())).toContain(
      'Retry initialization',
    );
    await ReactTestRenderer.act(async () => {
      renderer!.unmount();
    });
  },
  20000,
);
