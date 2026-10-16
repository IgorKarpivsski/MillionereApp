// The app only plays short sounds and music while it is open. expo-audio still ships two
// foreground services (lock-screen media controls and background recording); Google Play
// flags them because the app also has a BOOT_COMPLETED receiver (notifications), and on
// Android 15+ starting those service types from boot would crash. Remove them from the
// merged manifest, together with the permissions only they need.
const { withAndroidManifest } = require('expo/config-plugins');

const SERVICES = [
  'expo.modules.audio.service.AudioControlsService',
  'expo.modules.audio.service.AudioRecordingService',
];
const PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  'android.permission.RECORD_AUDIO',
];

module.exports = function withoutAudioServices(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';
    const app = manifest.application[0];
    app.service = (app.service || []).filter((s) => !SERVICES.includes(s.$['android:name']));
    for (const name of SERVICES) {
      app.service.push({ $: { 'android:name': name, 'tools:node': 'remove' } });
    }
    manifest['uses-permission'] = (manifest['uses-permission'] || []).filter((p) => !PERMISSIONS.includes(p.$['android:name']));
    for (const name of PERMISSIONS) {
      manifest['uses-permission'].push({ $: { 'android:name': name, 'tools:node': 'remove' } });
    }
    return cfg;
  });
};
