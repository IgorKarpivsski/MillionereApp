// Portrait-only apps make Play treat android.hardware.screen.portrait as required, and some
// libraries imply android.hardware.wifi; both quietly hide the app from tablets, Chromebooks
// and devices without those features. The game needs neither, so mark them optional.
const { withAndroidManifest } = require('expo/config-plugins');

const OPTIONAL = [
  'android.hardware.screen.portrait',
  'android.hardware.wifi',
  'android.hardware.touchscreen',
];

module.exports = function withOptionalFeatures(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';
    const features = (manifest['uses-feature'] || []).filter(
      (f) => !OPTIONAL.includes(f.$['android:name']),
    );
    for (const name of OPTIONAL) {
      features.push({
        $: {
          'android:name': name,
          'android:required': 'false',
          'tools:replace': 'android:required',
        },
      });
    }
    manifest['uses-feature'] = features;
    return cfg;
  });
};
