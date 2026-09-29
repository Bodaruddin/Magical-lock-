import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  Keyboard,
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';

const SETTINGS_KEY = 'lock-screen-simulation-settings-v1';
const TRIPLE_TAP_INTERVAL = 800;
const DEFAULT_SETTINGS: SimulationSettings = {
  enabled: true,
  attemptLimit: 5,
  demoPin: '2468',
  showIncorrectMessage: true,
  wallpaperUri: null,
};

type SimulationSettings = {
  enabled: boolean;
  attemptLimit: number;
  demoPin: string;
  showIncorrectMessage: boolean;
  wallpaperUri: string | null;
};

type AppScreen = 'lock' | 'setup' | 'home';

async function buzz(kind: 'light' | 'success' | 'error' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'success') {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } else if (kind === 'error') {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } else {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function LockGlyph({ size = 26, color = '#ffffff' }: { size?: number; color?: string }) {
  return <MaterialCommunityIcons name="lock-outline" size={size} color={color} />;
}

function FingerprintGlyph({ size = 64, color = colors.light.tint }: { size?: number; color?: string }) {
  return <MaterialCommunityIcons name="fingerprint" size={size} color={color} />;
}

function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, disabled && styles.disabled]}
      testID={`button-${label.toLowerCase().replaceAll(' ', '-')}`}
    >
      <Feather name={icon} size={24} color="#ffffff" />
    </Pressable>
  );
}

function Key({
  value,
  onPress,
  width,
}: {
  value: string;
  onPress: () => void;
  width: number;
}) {
  return (
    <Pressable
      accessibilityLabel={`Number ${value}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.key,
        { width, height: width * 0.9 },
        pressed && styles.keyPressed,
      ]}
      testID={`key-${value}`}
    >
      <Text style={styles.keyText}>{value}</Text>
    </Pressable>
  );
}

function SimulatedLockScreen({
  pin,
  notice,
  onNumber,
  onDelete,
  onSubmit,
  onEmergency,
}: {
  pin: string;
  notice: string;
  onNumber: (value: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  onEmergency: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const keyWidth = Math.min((width - 84) / 3, 92);
  const maskedPin = pin.length ? '•'.repeat(Math.min(pin.length, 12)) : '';

  return (
    <View style={[styles.lockScreen, { paddingTop: insets.top + 22, paddingBottom: insets.bottom + 8 }]}>
      <StatusBar style="light" hidden />
      <View style={styles.lockTop}>
        <View style={styles.lockMark}>
          <LockGlyph size={25} />
        </View>
        <Text style={styles.simulationCaption}>SIMULATION</Text>
      </View>

      <View style={[styles.lockContent, { minHeight: Math.max(height * 0.66, 500) }]}>
        <Text style={styles.instruction}>Use your fingerprint, face, or password.</Text>
        <View style={styles.pinTray} accessibilityLabel={`${pin.length} digits entered`}>
          <Text style={styles.pinText}>{maskedPin}</Text>
        </View>
        <View style={styles.noticeSlot} accessible accessibilityLiveRegion="polite">
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        </View>

        <View style={styles.keypad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((number) => (
            <Key key={number} value={number} onPress={() => onNumber(number)} width={keyWidth} />
          ))}
          <IconButton icon="delete" label="Delete last digit" onPress={onDelete} disabled={!pin.length} />
          <Key value="0" onPress={() => onNumber('0')} width={keyWidth} />
          <IconButton icon="check" label="Confirm PIN" onPress={onSubmit} disabled={!pin.length} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Emergency call"
          onPress={onEmergency}
          style={({ pressed }) => [styles.emergencyButton, pressed && styles.pressed]}
          testID="button-emergency-call"
        >
          <Text style={styles.emergencyText}>Emergency call</Text>
        </Pressable>

        <View style={styles.fingerprintWrap}>
          <FingerprintGlyph />
        </View>
      </View>
      <View style={styles.gestureHint} accessible={false}>
        <Text style={styles.gestureHintText}>Demo lock screen</Text>
      </View>
    </View>
  );
}

function SetupScreen({
  settings,
  onChange,
  onSave,
  onReset,
  onPreview,
  onBack,
  onRefreshWallpaper,
  wallpaperMessage,
}: {
  settings: SimulationSettings;
  onChange: (next: Partial<SimulationSettings>) => void;
  onSave: (next: Partial<SimulationSettings>) => void;
  onReset: () => void;
  onPreview: (next: Partial<SimulationSettings>) => void;
  onBack: () => void;
  onRefreshWallpaper: () => void;
  wallpaperMessage: string;
}) {
  const insets = useSafeAreaInsets();
  const [pinDraft, setPinDraft] = useState(settings.demoPin);
  const [attemptDraft, setAttemptDraft] = useState(String(settings.attemptLimit));

  useEffect(() => {
    setPinDraft(settings.demoPin);
    setAttemptDraft(String(settings.attemptLimit));
  }, [settings.attemptLimit, settings.demoPin]);

  const commitDrafts = (): Partial<SimulationSettings> => {
    const normalizedPin = pinDraft.replace(/\D/g, '').slice(0, 12);
    const normalizedAttempts = Math.min(20, Math.max(1, Number(attemptDraft) || 1));
    const next = {
      demoPin: normalizedPin || DEFAULT_SETTINGS.demoPin,
      attemptLimit: normalizedAttempts,
    };
    onChange(next);
    return next;
  };

  const save = () => {
    Keyboard.dismiss();
    onSave(commitDrafts());
  };

  return (
    <View style={styles.setupScreen}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.setupScroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 30 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.setupHeader}>
          <IconButton icon="arrow-left" label="Return to lock screen" onPress={onBack} />
          <View style={styles.setupTitleWrap}>
            <Text style={styles.eyebrow}>PRIVATE CONFIGURATION</Text>
            <Text style={styles.setupTitle}>Simulation settings</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.infoBanner}>
          <MaterialCommunityIcons name="shield-check-outline" size={23} color={colors.light.tint} />
          <Text style={styles.infoBannerText}>
            These controls only affect this app’s demo environment. Your real device credentials are never read or changed.
          </Text>
        </View>

        <SettingSection title="Lock screen settings" subtitle="Control the simulated unlock experience.">
          <SettingRow
            title="Enable simulated lock screen"
            description="Start a new session on the demo lock screen."
            right={<Switch value={settings.enabled} onValueChange={(enabled) => onChange({ enabled })} trackColor={{ false: '#42505a', true: '#347f91' }} thumbColor={settings.enabled ? '#9cefff' : '#d9e2e5'} />}
          />
          <SettingRow
            title="Incorrect password message"
            description="Show feedback after an incorrect submission."
            right={<Switch value={settings.showIncorrectMessage} onValueChange={(showIncorrectMessage) => onChange({ showIncorrectMessage })} trackColor={{ false: '#42505a', true: '#347f91' }} thumbColor={settings.showIncorrectMessage ? '#9cefff' : '#d9e2e5'} />}
          />
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Attempts before demo opens</Text>
            <Text style={styles.fieldDescription}>Choose any limit from 1 to 20. The demo opens once this limit is reached.</Text>
            <TextInput
              accessibilityLabel="Attempts before demo opens"
              keyboardType="number-pad"
              maxLength={2}
              onChangeText={setAttemptDraft}
              onBlur={() => setAttemptDraft(String(Math.min(20, Math.max(1, Number(attemptDraft) || 1))))}
              style={styles.fieldInput}
              value={attemptDraft}
              testID="input-attempt-limit"
            />
          </View>
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Custom demo PIN</Text>
            <Text style={styles.fieldDescription}>Use digits only. This PIN is local to the simulation.</Text>
            <TextInput
              accessibilityLabel="Custom demo PIN"
              keyboardType="number-pad"
              maxLength={12}
              onChangeText={(value) => setPinDraft(value.replace(/\D/g, ''))}
              secureTextEntry
              style={styles.fieldInput}
              value={pinDraft}
              testID="input-demo-pin"
            />
          </View>
        </SettingSection>

        <SettingSection title="Background settings" subtitle="Use the current mobile wallpaper when the platform makes it available.">
          <SettingRow
            title="Current background"
            description={settings.wallpaperUri ? 'Wallpaper loaded from the device.' : 'Wallpaper access is unavailable in this preview, so the neutral fallback is active.'}
            right={<View style={[styles.statusDot, settings.wallpaperUri && styles.statusDotActive]} />}
          />
          <Pressable onPress={onRefreshWallpaper} style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
            <Feather name="refresh-cw" size={17} color={colors.light.tint} />
            <Text style={styles.outlineButtonText}>Refresh wallpaper</Text>
          </Pressable>
          {wallpaperMessage ? <Text style={styles.wallpaperMessage}>{wallpaperMessage}</Text> : null}
        </SettingSection>

        <SettingSection title="General" subtitle="Preview and manage local settings.">
          <Pressable onPress={() => onPreview(commitDrafts())} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Feather name="eye" size={17} color="#10222a" />
            <Text style={styles.primaryButtonText}>Preview lock screen</Text>
          </Pressable>
          <Pressable onPress={onReset} style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
            <Feather name="rotate-ccw" size={17} color={colors.light.tint} />
            <Text style={styles.outlineButtonText}>Reset to defaults</Text>
          </Pressable>
          <Pressable onPress={save} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
            <Text style={styles.saveButtonText}>Save settings</Text>
          </Pressable>
        </SettingSection>
      </ScrollView>
    </View>
  );
}

function SettingSection({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View style={styles.settingSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function SettingRow({ title, description, right }: { title: string; description: string; right: React.ReactNode }) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      {right}
    </View>
  );
}

function HomeScreen({
  settings,
  attempts,
  onLock,
  onSettings,
}: {
  settings: SimulationSettings;
  attempts: number;
  onLock: () => void;
  onSettings: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.homeScreen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.homeScroll, { paddingTop: insets.top + 22, paddingBottom: insets.bottom + 30 }]}>
        <View style={styles.homeBrand}>
          <View style={styles.homeIcon}>
            <LockGlyph size={25} color={colors.light.tint} />
          </View>
          <Text style={styles.eyebrow}>DEMO ENVIRONMENT</Text>
        </View>
        <Text style={styles.homeTitle}>Welcome back.</Text>
        <Text style={styles.homeSubtitle}>You’re inside the safe, self-contained preview of your simulated lock screen.</Text>

        <View style={styles.statusCard}>
          <View style={styles.statusCardHeader}>
            <View style={styles.statusIcon}><MaterialCommunityIcons name="shield-check-outline" size={24} color={colors.light.tint} /></View>
            <View>
              <Text style={styles.statusCardLabel}>SIMULATION STATUS</Text>
              <Text style={styles.statusCardTitle}>{settings.enabled ? 'Lock screen enabled' : 'Lock screen disabled'}</Text>
            </View>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.statusMetaRow}>
            <View><Text style={styles.statusMetaLabel}>ATTEMPT LIMIT</Text><Text style={styles.statusMetaValue}>{settings.attemptLimit}</Text></View>
            <View><Text style={styles.statusMetaLabel}>THIS SESSION</Text><Text style={styles.statusMetaValue}>{attempts}</Text></View>
            <View><Text style={styles.statusMetaLabel}>PIN</Text><Text style={styles.statusMetaValue}>{settings.demoPin.length} digits</Text></View>
          </View>
        </View>

        <View style={styles.homeActions}>
          <Pressable onPress={onLock} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <LockGlyph size={18} color="#10222a" />
            <Text style={styles.primaryButtonText}>Return to lock screen</Text>
          </Pressable>
          <Pressable onPress={onSettings} style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
            <Feather name="sliders" size={18} color={colors.light.tint} />
            <Text style={styles.outlineButtonText}>Open settings</Text>
          </Pressable>
        </View>

        <View style={styles.safetyNote}>
          <Feather name="info" size={16} color="#9cabb3" />
          <Text style={styles.safetyNoteText}>This is a simulation. It cannot unlock, monitor, or change your actual Android device.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

export default function IndexScreen() {
  const [screen, setScreen] = useState<AppScreen>('lock');
  const [settings, setSettings] = useState<SimulationSettings>(DEFAULT_SETTINGS);
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [notice, setNotice] = useState('');
  const [wallpaperMessage, setWallpaperMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const tripleTapCount = useRef(0);
  const tripleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const transitionTo = useCallback((nextScreen: AppScreen) => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: nextScreen === 'setup' ? 12 : -8, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setScreen(nextScreen);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 150, useNativeDriver: true }),
      ]).start();
    });
  }, [opacity, translateY]);

  const beginSession = useCallback((sessionOverrides: Partial<SimulationSettings> = {}) => {
    const sessionSettings = { ...settings, ...sessionOverrides };
    setAttempts(0);
    setPin('');
    setNotice('');
    tripleTapCount.current = 0;
    if (sessionSettings.enabled) {
      transitionTo('lock');
    } else {
      transitionTo('home');
    }
  }, [settings, transitionTo]);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((stored) => {
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<SimulationSettings>;
          const merged = { ...DEFAULT_SETTINGS, ...parsed };
          setSettings(merged);
          if (!merged.enabled) setScreen('home');
        }
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const onBack = () => {
      if (screen === 'setup') {
        transitionTo('lock');
        return true;
      }
      if (screen === 'home') {
        beginSession();
        return true;
      }
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => subscription.remove();
  }, [beginSession, screen, transitionTo]);

  useEffect(() => {
    return () => {
      if (tripleTapTimer.current) clearTimeout(tripleTapTimer.current);
    };
  }, []);

  const updateSettings = useCallback((next: Partial<SimulationSettings>) => {
    setSettings((current) => ({ ...current, ...next }));
  }, []);

  const saveSettings = useCallback(async (draft: Partial<SimulationSettings> = {}) => {
    const safeSettings: SimulationSettings = {
      ...settings,
      ...draft,
      attemptLimit: Math.min(20, Math.max(1, draft.attemptLimit ?? settings.attemptLimit)),
      demoPin: (draft.demoPin ?? settings.demoPin).replace(/\D/g, '').slice(0, 12) || DEFAULT_SETTINGS.demoPin,
    };
    setSettings(safeSettings);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(safeSettings));
    await buzz('success');
    setNotice('Settings saved.');
    transitionTo(safeSettings.enabled ? 'lock' : 'home');
  }, [settings, transitionTo]);

  const resetSettings = useCallback(() => {
    Alert.alert('Reset settings?', 'This restores the default demo PIN and attempt limit.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          setSettings(DEFAULT_SETTINGS);
          await AsyncStorage.removeItem(SETTINGS_KEY);
          setWallpaperMessage('Defaults restored.');
          await buzz('light');
        },
      },
    ]);
  }, []);

  const refreshWallpaper = useCallback(async () => {
    setWallpaperMessage('');
    try {
      const wallpaperModule = NativeModules.WallpaperModule as { getCurrentWallpaper?: () => Promise<string> } | undefined;
      if (wallpaperModule?.getCurrentWallpaper) {
        const uri = await wallpaperModule.getCurrentWallpaper();
        if (uri) {
          updateSettings({ wallpaperUri: uri });
          setWallpaperMessage('Device wallpaper refreshed.');
          return;
        }
      }
      setWallpaperMessage('Wallpaper access is unavailable here. Neutral fallback remains active.');
    } catch {
      setWallpaperMessage('Wallpaper access was unavailable. Neutral fallback remains active.');
    }
  }, [updateSettings]);

  const submitPin = useCallback((submittedPin: string) => {
    if (!submittedPin) {
      setNotice('Enter your demo PIN first.');
      return;
    }
    setNotice('');
    setPin('');
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    if (submittedPin === settings.demoPin) {
      void buzz('success');
      transitionTo('home');
      return;
    }
    if (nextAttempts >= settings.attemptLimit) {
      void buzz('success');
      setNotice('Demo limit reached. Opening preview.');
      transitionTo('home');
      return;
    }
    void buzz('error');
    setNotice(settings.showIncorrectMessage ? 'Incorrect password. Please try again.' : '');
  }, [attempts, settings.attemptLimit, settings.demoPin, settings.showIncorrectMessage, transitionTo]);

  const onNumber = useCallback((value: string) => {
    void buzz();
    setNotice('');
    if (value === '0') {
      if (tripleTapTimer.current) clearTimeout(tripleTapTimer.current);
      tripleTapCount.current += 1;
      if (tripleTapCount.current >= 3) {
        tripleTapCount.current = 0;
        setPin('');
        transitionTo('setup');
        return;
      }
      tripleTapTimer.current = setTimeout(() => {
        tripleTapCount.current = 0;
      }, TRIPLE_TAP_INTERVAL);
    } else {
      tripleTapCount.current = 0;
      if (tripleTapTimer.current) clearTimeout(tripleTapTimer.current);
    }

    const nextPin = pin.length < 12 ? pin + value : pin;
    setPin(nextPin);
    const configuredLength = settings.demoPin.length;
    const shouldAutoSubmit =
      nextPin.length === 6 ||
      (configuredLength > 0 && configuredLength < 6 && nextPin.length === configuredLength);
    if (shouldAutoSubmit) {
      submitPin(nextPin);
    }
  }, [pin, settings.demoPin.length, submitPin, transitionTo]);

  const onSubmit = useCallback(() => {
    submitPin(pin);
  }, [pin, submitPin]);

  const renderedScreen = useMemo(() => {
    if (!loaded) return null;
    if (screen === 'setup') {
      return (
        <SetupScreen
          settings={settings}
          onChange={updateSettings}
          onSave={saveSettings}
          onReset={resetSettings}
          onPreview={(draft) => beginSession(draft)}
          onBack={() => transitionTo('lock')}
          onRefreshWallpaper={refreshWallpaper}
          wallpaperMessage={wallpaperMessage}
        />
      );
    }
    if (screen === 'home') {
      return <HomeScreen settings={settings} attempts={attempts} onLock={beginSession} onSettings={() => transitionTo('setup')} />;
    }
    return (
      <SimulatedLockScreen
        pin={pin}
        notice={notice}
        onNumber={onNumber}
        onDelete={() => { void buzz(); setPin((current) => current.slice(0, -1)); }}
        onSubmit={onSubmit}
        onEmergency={() => Alert.alert('Emergency call', 'This simulation does not place calls.') }
      />
    );
  }, [attempts, beginSession, loaded, notice, onNumber, onSubmit, pin, refreshWallpaper, resetSettings, saveSettings, screen, settings, transitionTo, updateSettings, wallpaperMessage]);

  return (
    <Animated.View style={[styles.appRoot, { opacity, transform: [{ translateY }] }]}>
      {renderedScreen}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  appRoot: { flex: 1, backgroundColor: '#607178' },
  lockScreen: { flex: 1, backgroundColor: '#607178', alignItems: 'center' },
  lockTop: { alignItems: 'center', gap: 8 },
  lockMark: { alignItems: 'center', justifyContent: 'center', height: 34 },
  simulationCaption: { color: 'rgba(255,255,255,0.55)', fontSize: 9, letterSpacing: 2.4, fontFamily: 'Inter_600SemiBold' },
  lockContent: { width: '100%', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 78 },
  instruction: { color: '#ffffff', fontSize: 16, fontFamily: 'Inter_600SemiBold', textAlign: 'center', paddingHorizontal: 20, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  pinTray: { width: '58%', maxWidth: 275, minWidth: 180, height: 42, borderRadius: 12, backgroundColor: 'rgba(239,247,249,0.56)', marginTop: 23, alignItems: 'center', justifyContent: 'center', shadowColor: '#1c3a47', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  pinText: { color: '#ffffff', fontSize: 21, letterSpacing: 6, height: 28, fontFamily: 'Inter_600SemiBold', textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 2 },
  noticeSlot: { height: 42, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  notice: { color: '#ffffff', fontSize: 12, fontFamily: 'Inter_500Medium', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 2 },
  keypad: { width: '100%', maxWidth: 320, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 4, marginTop: 6, paddingHorizontal: 18 },
  key: { alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  keyPressed: { backgroundColor: 'rgba(255,255,255,0.14)' },
  keyText: { color: '#ffffff', fontSize: 30, fontFamily: 'Inter_400Regular', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  iconButton: { alignItems: 'center', justifyContent: 'center', borderRadius: 999, width: 68, height: 68 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.38 },
  emergencyButton: { paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  emergencyText: { color: '#ffffff', fontSize: 14, fontFamily: 'Inter_500Medium', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 2 },
  fingerprintWrap: { marginTop: 23, alignItems: 'center', justifyContent: 'center', shadowColor: '#08ccf4', shadowOpacity: 0.75, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  gestureHint: { position: 'absolute', bottom: 7, alignItems: 'center' },
  gestureHintText: { color: 'rgba(255,255,255,0.38)', fontSize: 9, fontFamily: 'Inter_400Regular', letterSpacing: 0.3 },
  setupScreen: { flex: 1, backgroundColor: colors.light.background },
  setupScroll: { paddingHorizontal: 20 },
  setupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  setupTitleWrap: { flex: 1, paddingHorizontal: 6 },
  headerSpacer: { width: 42 },
  eyebrow: { color: colors.light.tint, fontSize: 10, letterSpacing: 1.7, fontFamily: 'Inter_700Bold' },
  setupTitle: { color: colors.light.foreground, fontSize: 24, fontFamily: 'Inter_700Bold', marginTop: 4 },
  infoBanner: { backgroundColor: colors.light.accent, borderColor: '#2d5965', borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', gap: 10, marginBottom: 25 },
  infoBannerText: { flex: 1, color: '#c5edf4', fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  settingSection: { marginBottom: 24 },
  sectionTitle: { color: colors.light.foreground, fontSize: 18, fontFamily: 'Inter_700Bold' },
  sectionSubtitle: { color: colors.light.mutedForeground, fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 10, fontFamily: 'Inter_400Regular' },
  sectionCard: { backgroundColor: colors.light.card, borderColor: colors.light.border, borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, overflow: 'hidden' },
  settingRow: { minHeight: 78, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomColor: '#30424c', borderBottomWidth: 1 },
  settingCopy: { flex: 1, paddingRight: 12 },
  settingTitle: { color: colors.light.cardForeground, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  settingDescription: { color: colors.light.mutedForeground, fontSize: 11, lineHeight: 16, marginTop: 4, fontFamily: 'Inter_400Regular' },
  statusDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#67757b' },
  statusDotActive: { backgroundColor: colors.light.tint, shadowColor: colors.light.tint, shadowOpacity: 0.7, shadowRadius: 8 },
  fieldBlock: { paddingVertical: 15, borderBottomColor: '#30424c', borderBottomWidth: 1 },
  fieldLabel: { color: colors.light.cardForeground, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  fieldDescription: { color: colors.light.mutedForeground, fontSize: 11, lineHeight: 16, marginTop: 4, fontFamily: 'Inter_400Regular' },
  fieldInput: { backgroundColor: '#14222a', borderColor: '#40555f', borderWidth: 1, borderRadius: 11, height: 44, paddingHorizontal: 13, color: colors.light.foreground, fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 10 },
  outlineButton: { height: 48, borderColor: '#45616b', borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginVertical: 14 },
  outlineButtonText: { color: colors.light.tint, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  wallpaperMessage: { color: colors.light.mutedForeground, fontSize: 11, lineHeight: 16, paddingBottom: 13, fontFamily: 'Inter_400Regular' },
  primaryButton: { height: 52, borderRadius: 14, backgroundColor: colors.light.tint, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, marginVertical: 14 },
  primaryButtonText: { color: '#10222a', fontSize: 14, fontFamily: 'Inter_700Bold' },
  saveButton: { height: 52, borderRadius: 14, backgroundColor: '#eff8fa', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  saveButtonText: { color: '#15232a', fontSize: 14, fontFamily: 'Inter_700Bold' },
  homeScreen: { flex: 1, backgroundColor: colors.light.background },
  homeScroll: { paddingHorizontal: 22 },
  homeBrand: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  homeIcon: { width: 46, height: 46, borderRadius: 15, borderWidth: 1, borderColor: '#356a76', backgroundColor: '#19333d', alignItems: 'center', justifyContent: 'center' },
  homeTitle: { color: colors.light.foreground, fontSize: 34, lineHeight: 40, fontFamily: 'Inter_700Bold', marginTop: 32 },
  homeSubtitle: { color: colors.light.mutedForeground, fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', marginTop: 10, maxWidth: 335 },
  statusCard: { backgroundColor: '#192b34', borderColor: '#33515d', borderWidth: 1, borderRadius: 20, padding: 18, marginTop: 30 },
  statusCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#183b45', alignItems: 'center', justifyContent: 'center' },
  statusCardLabel: { color: '#82a7b0', fontSize: 9, letterSpacing: 1.4, fontFamily: 'Inter_700Bold' },
  statusCardTitle: { color: colors.light.foreground, fontSize: 16, marginTop: 5, fontFamily: 'Inter_600SemiBold' },
  statusDivider: { height: 1, backgroundColor: '#2e4650', marginVertical: 18 },
  statusMetaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statusMetaLabel: { color: '#82a7b0', fontSize: 9, letterSpacing: 0.7, fontFamily: 'Inter_600SemiBold' },
  statusMetaValue: { color: colors.light.foreground, fontSize: 16, marginTop: 6, fontFamily: 'Inter_600SemiBold' },
  homeActions: { marginTop: 12 },
  safetyNote: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginTop: 22, paddingHorizontal: 4 },
  safetyNoteText: { flex: 1, color: '#899ba3', fontSize: 11, lineHeight: 17, fontFamily: 'Inter_400Regular' },
});