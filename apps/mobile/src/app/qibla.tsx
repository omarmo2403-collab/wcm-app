import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import Stack from 'expo-router/stack';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useAppConfig } from '@/features/prayer-times/config';
import { colors, spacing } from '@/theme/tokens';

const KAABA = { lat: 21.4225, lng: 39.8262 };

/** Great-circle initial bearing from (lat,lng) to the Kaaba, degrees from true north. */
function qiblaBearing(lat: number, lng: number): number {
  const φ1 = (lat * Math.PI) / 180;
  const φ2 = (KAABA.lat * Math.PI) / 180;
  const Δλ = ((KAABA.lng - lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export default function QiblaScreen() {
  const config = useAppConfig();
  const fallbackBearing =
    typeof config.data?.qibla_bearing_degrees === 'number'
      ? config.data.qibla_bearing_degrees
      : 119;

  const [ownBearing, setOwnBearing] = useState<number | null>(null); // from device location
  const [heading, setHeading] = useState<number | null>(null);
  const [sensorOk, setSensorOk] = useState(false);
  // admin-configured Wembley bearing until (unless) device location refines it
  const bearing = ownBearing ?? fallbackBearing;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let sub: { remove: () => void } | undefined;
    let cancelled = false;
    (async () => {
      let locationGranted = false;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        locationGranted = status === 'granted';
      } catch {
        /* treat as denied */
      }

      // Compass first — heading is independent of position, and a slow GPS
      // fix must not leave the needle dead. Preferred: OS sensor fusion via
      // watchHeadingAsync (tilt-compensated, declination-corrected).
      let haveHeadingWatch = false;
      if (locationGranted) {
        try {
          const headingSub = await Location.watchHeadingAsync((h) => {
            const value = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
            if (value >= 0) {
              setSensorOk(true);
              setHeading(value);
            }
          });
          if (cancelled) headingSub.remove();
          else sub = headingSub;
          haveHeadingWatch = true;
        } catch {
          /* fall through to raw magnetometer */
        }
      }
      if (!haveHeadingWatch) {
        const available = await Magnetometer.isAvailableAsync().catch(() => false);
        if (available && !cancelled) {
          setSensorOk(true);
          Magnetometer.setUpdateInterval(120);
          sub = Magnetometer.addListener(({ x, y }) => {
            // device heading θ (0 = phone top at north): Bx=-sinθ, By=cosθ
            // → atan2(y,x) = 90°+θ, so θ = atan2deg − 90 (mod 360)
            const angle = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
            setHeading((angle - 90 + 360) % 360);
          });
        }
      }

      // Position refines the bearing; failure (GPS off, timeout) keeps Wembley
      if (locationGranted) {
        try {
          const pos = await Location.getLastKnownPositionAsync() ??
            await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          if (pos && !cancelled) setOwnBearing(qiblaBearing(pos.coords.latitude, pos.coords.longitude));
        } catch {
          /* location services off — Wembley fallback stands */
        }
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const needleRotation = heading == null ? 0 : (bearing - heading + 360) % 360;

  return (
    <>
      <Stack.Screen options={{ title: 'Qibla' }} />
      <View style={styles.screen}>
        <Text style={styles.title}>Qibla Direction</Text>

        <View style={styles.compass}>
          <Text style={[styles.cardinal, styles.n]}>N</Text>
          <Text style={[styles.cardinal, styles.e]}>E</Text>
          <Text style={[styles.cardinal, styles.s]}>S</Text>
          <Text style={[styles.cardinal, styles.w]}>W</Text>
          <View style={[styles.needleWrap, { transform: [{ rotate: `${needleRotation}deg` }] }]}>
            <View style={styles.needle} />
            <MaterialCommunityIcons
              name="cube"
              size={26}
              color={colors.primary}
              style={styles.kaaba}
            />
          </View>
          <View style={styles.hub} />
        </View>

        <Text style={styles.info}>
          Qibla from {ownBearing != null ? 'your location' : 'Wembley'}:{' '}
          <Text style={styles.bold}>{Math.round(bearing)}°</Text>
        </Text>
        <Text style={styles.note}>
          {Platform.OS === 'web'
            ? 'Live compass needs the mobile app — bearing shown is from the Masjid.'
            : sensorOk
              ? 'Hold your phone flat. Move it in a figure-of-8 to calibrate the compass.'
              : 'Compass sensor unavailable — bearing shown relative to north.'}
        </Text>
      </View>
    </>
  );
}

const SIZE = 260;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground, alignItems: 'center', paddingTop: 30 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 26 },
  compass: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 3,
    borderColor: colors.primary,
    backgroundColor: colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardinal: { position: 'absolute', fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  n: { top: 10, alignSelf: 'center', color: colors.primary },
  e: { right: 12, top: SIZE / 2 - 10 },
  s: { bottom: 10, alignSelf: 'center' },
  w: { left: 12, top: SIZE / 2 - 10 },
  needleWrap: { position: 'absolute', width: SIZE, height: SIZE, alignItems: 'center' },
  needle: {
    position: 'absolute',
    top: 40,
    width: 4,
    height: SIZE / 2 - 44,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  kaaba: { position: 'absolute', top: 12 },
  hub: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primaryPressed,
  },
  info: { marginTop: 26, fontSize: 15, color: colors.text },
  bold: { fontWeight: '700', color: colors.primary },
  note: {
    marginTop: spacing.sm,
    fontSize: 12.5,
    color: colors.textMuted,
    textAlign: 'center',
    marginHorizontal: 40,
    lineHeight: 18,
  },
});
