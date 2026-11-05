declare module '*.svg' {
  import type { FC } from 'react';
  import type { SvgProps } from 'react-native-svg';
  const Icon: FC<SvgProps>;
  export default Icon;
}
