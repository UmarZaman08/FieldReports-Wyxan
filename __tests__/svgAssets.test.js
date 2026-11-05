const fs = require('fs');
const path = require('path');
const { createTransformer } = require('react-native-svg-transformer');

const assets = path.resolve(__dirname, '../src/assets');
const files = fs.readdirSync(assets).filter(file => file.endsWith('.svg'));
// Capture the exact source passed to React Native's Babel transformer.
const transform = createTransformer({ transform: ({ src }) => src });

test('Metro loads SVGs as components instead of numeric image assets', () => {
  const config = require('../metro.config');
  expect(config.resolver.assetExts).not.toContain('svg');
  expect(config.resolver.sourceExts).toContain('svg');
  expect(config.transformer.babelTransformerPath).toBe(
    require.resolve('react-native-svg-transformer/react-native'),
  );
});

test.each(files)(
  '%s transforms to a native component with overridable root props',
  async file => {
    const filename = path.join(assets, file);
    const src = fs.readFileSync(filename, 'utf8');
    const output = await transform({ src, filename });
    expect(output).toContain('react-native-svg');
    expect(output).toContain('viewBox="0 0 24 24"');
    const stroke = src.match(/stroke="([^"]+)"/)[1];
    expect(output).toContain(`stroke="${stroke}"`);
    expect(output.indexOf('{...props}')).toBeGreaterThan(
      output.indexOf(`stroke="${stroke}"`),
    );
    if (file === 'images.svg') {
      expect(output).toContain('fill="currentColor"');
    }
  },
);
