module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|@bam\\.tech|react-native-image-picker|react-native-safe-area-context|react-native-screens)/)',
  ],
};
