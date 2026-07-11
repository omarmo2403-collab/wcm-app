// resolved via the expo package — pnpm does not hoist @expo/config-plugins
const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Remove expo-notifications' Firebase Messaging service from the merged
 * Android manifest.
 *
 * WHY (12 Jul 2026, verified on device via dumpsys notification): OneSignal
 * and expo-notifications BOTH handle every incoming FCM push — OneSignal
 * renders the real notification (title + message, fcm_fallback channel,
 * os_group grouping) while ExpoFirebaseMessagingService renders a bare
 * duplicate (title only, expo_notifications_fallback channel, tagged with the
 * raw FCM message id). Users saw every push twice.
 *
 * Local prayer alerts are NOT affected: scheduling/display/boot-reschedule
 * run through expo-notifications' NotificationsService receiver, not the FCM
 * service removed here. Remote push is OneSignal's job alone.
 */
const EXPO_FCM_SERVICE = 'expo.modules.notifications.service.ExpoFirebaseMessagingService';

module.exports = function withoutExpoFcm(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$ = manifest.$ ?? {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const app = manifest.application[0];
    app.service = app.service ?? [];
    if (!app.service.some((s) => s.$?.['android:name'] === EXPO_FCM_SERVICE)) {
      // manifest-merger drops the library's <service> at build time
      app.service.push({ $: { 'android:name': EXPO_FCM_SERVICE, 'tools:node': 'remove' } });
    }
    return config;
  });
};
