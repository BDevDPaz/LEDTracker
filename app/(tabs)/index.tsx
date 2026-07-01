import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';

import { engine } from '../../src/engine/workTrackerEngine';
import { selectActiveSession, selectIsLoading } from '../../src/engine/selectors/workTrackerSelectors';
import { useLanguage } from '../../src/context/LanguageContext';
import { useLuxuryUI } from '../../src/context/LuxuryUIContext';
import { COLORS } from '../../src/constants/theme';
import {
  LuxuryCard,
  LuxuryButton,
  GlassModalWrapper,
} from '../../src/components/ui/LuxuryUI';
import { formatTime } from '../../src/utils/dateUtils';
import { DailySetupModal } from '../../src/components/modals/DailySetupModal';
import { LunchModal } from '../../src/components/modals/LunchModal';
import { log } from '../../src/utils/logger';
import { getHistory, getSettings } from '../../src/database/db';
import { calculateSessionMinutes } from '../../src/utils/payrollUtils';
import dayjs from '../../src/utils/dayjsSetup';

export default function HomeScreen() {
  const { t } = useLanguage();
  const { showToast } = useLuxuryUI();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Engine state
  const [engineState, setEngineState] = useState(engine.getState());

  const activeSession = useMemo(() => selectActiveSession(engineState), [engineState]);
  const isProcessing = useMemo(() => selectIsLoading(engineState), [engineState]);

  const [stats, setStats] = useState({ hours: 0, earnings: 0 });
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupMode, setSetupMode] = useState<'start' | 'transit'>('start');
  const [showLunchModal, setShowLunchModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Easter Egg
  const [tapCount, setTapCount] = useState(0);
  const [showSpecialCard, setShowSpecialCard] = useState(false);
  const iconScale = useSharedValue(1);

  useEffect(() => {
    const unsubscribe = engine.subscribe(setEngineState);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    engine.dispatch({ type: 'APP_INIT' });
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const history = await getHistory();
      const settings = await getSettings();
      const rate = settings?.hourly_rate || 0;

      let totalMinutes = 0;
      const today = dayjs().format('YYYY-MM-DD');

      history.forEach((s) => {
        if (s.date_string === today && s.status === 'completed' && s.start_time && s.end_time) {
          totalMinutes += calculateSessionMinutes(
            s.start_time,
            s.end_time,
            s.lunch_taken || 0,
            s.lunch_start,
            s.lunch_end
          );
        }
      });

      const hours = totalMinutes / 60;
      setStats({ hours, earnings: hours * rate });
    } catch (_e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error cargando estadísticas', _e);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [activeSession, loadStats]);

  useEffect(() => {
    if (params.showSetup === 'true') {
      setSetupMode('start');
      setShowSetupModal(true);
    }
    if (params.showCheckoutPrompt === 'true') {
       setShowLunchModal(true);
    }
  }, [params]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await engine.dispatch({ type: 'APP_INIT' });
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  const handleSetupSubmit = (addr: string, client: string, notes: string) => {
    setShowSetupModal(false);
    router.setParams({ showSetup: undefined });
    engine.dispatch({ type: 'START_SESSION_REQUEST', address: addr, client, notes });
  };

  const handleClockOut = () => {
    setShowLunchModal(true);
  };

  const completeSession = (lunchMin: number) => {
    setShowLunchModal(false);
    router.setParams({ showCheckoutPrompt: undefined });
    engine.dispatch({ type: 'STOP_SESSION_REQUEST', lunchMinutes: lunchMin });
    showToast(t.toast_shift_ended || 'Jornada finalizada', 'success');
  };

  const handleEasterEggTap = () => {
    const nextTap = tapCount + 1;
    setTapCount(nextTap);

    iconScale.value = withSequence(withSpring(1.5), withSpring(1));

    if (nextTap >= 7) {
      setShowSpecialCard(true);
      setTapCount(0);
    }
  };

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const getStatusIcon = () => {
    if (!activeSession) return 'power-outline';
    if (activeSession.status === 'pending_arrival') return 'location-outline';
    return 'briefcase-outline';
  };

  const getStatusColor = () => {
    if (!activeSession) return COLORS.textSecondary;
    if (activeSession.status === 'pending_arrival') return '#f59e0b';
    return COLORS.success;
  };

  const displayAddress = activeSession?.address || t.no_activity || 'No hay actividad registrada.';

  return (
    <SafeAreaView testID='home-screen' style={styles.container} edges={['top']}>
      <ScrollView
        testID='home-scroll-view'
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.gold}
          />
        }
      >
        <Animated.View entering={FadeIn} testID='home-header' style={styles.header}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text testID='home-title' style={styles.appTitle}>
                {t.header_title || 'WTracker'}
              </Text>
              <TouchableOpacity
                testID='home-easter-egg-trigger'
                onPress={handleEasterEggTap}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Easter Egg"
                accessibilityHint="Muestra información del desarrollador"
              >
                <Animated.View style={animatedIconStyle}>
                  <Ionicons name='flash' size={18} color={COLORS.gold} />
                </Animated.View>
              </TouchableOpacity>
            </View>

            <View testID='home-status-badge' style={styles.statusBadge}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: activeSession
                      ? activeSession.status === 'active'
                        ? COLORS.success
                        : '#f59e0b'
                      : '#666',
                  },
                ]}
              />
              <Text testID='home-status-text' style={styles.statusText}>
                {!activeSession
                  ? t.status_inactive
                  : activeSession.status === 'pending_arrival'
                    ? t.status_pending
                    : activeSession.status === 'travel'
                      ? t.status_transit
                      : t.status_active}
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100)} testID='home-card-wrapper'>
          <LuxuryCard active={!!activeSession} style={{ minHeight: 220, justifyContent: 'center' }}>
            {isProcessing ? (
              <ActivityIndicator testID='home-loading-indicator' size='large' color={COLORS.gold} />
            ) : (
              <View testID='home-session-state' style={{ alignItems: 'center' }}>
                <View
                  testID='home-icon-bubble'
                  style={[
                    styles.iconBubble,
                    activeSession && { backgroundColor: 'rgba(255,255,255,0.05)' },
                  ]}
                >
                  <Ionicons name={getStatusIcon()} size={32} color={getStatusColor()} />
                </View>

                <Text testID='home-location-label' style={styles.label}>
                  {activeSession?.status === 'pending_arrival'
                    ? t.label_destination
                    : t.label_location}
                </Text>

                <Text
                  testID='home-address'
                  style={[
                    styles.addressText,
                    activeSession && { color: '#FFF' },
                  ]}
                >
                  {displayAddress}
                </Text>

                {activeSession && activeSession.status !== 'pending_arrival' && (
                  <View testID='home-timer-badge' style={styles.timerBadge}>
                    <Ionicons name='time-outline' size={14} color={COLORS.gold} />
                    <Text testID='home-timer-text' style={styles.timerText}>
                      {formatTime(
                        activeSession.actual_start_time || activeSession.start_time
                      )}{' '}
                      - En curso
                    </Text>
                  </View>
                )}

                {activeSession?.status === 'pending_arrival' && (
                  <Text
                    testID='home-geofence-hint'
                    style={{
                      color: '#f59e0b',
                      fontSize: 10,
                      marginTop: 10,
                      fontFamily: 'Montserrat_600SemiBold',
                    }}
                  >
                    {t.hint_geofence_active}
                  </Text>
                )}
              </View>
            )}
          </LuxuryCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200)} testID='home-primary-action-wrapper'>
          <LuxuryButton
            testID='home-primary-action'
            style={{ marginBottom: 16 }}
            text={activeSession ? t.btn_clock_out : t.btn_new_job}
            variant={activeSession ? 'danger' : 'primary'}
            onPress={
              activeSession
                ? handleClockOut
                : () => {
                    setSetupMode('start');
                    setShowSetupModal(true);
                  }
            }
            disabled={isProcessing}
            icon={
              <Ionicons
                name={activeSession ? 'stop' : 'play'}
                size={18}
                color={activeSession ? '#FFF' : '#000'}
              />
            }
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300)} testID='home-stats-container' style={styles.statsContainer}>
          <LuxuryCard style={styles.statBox}>
            <Text style={styles.statLabel}>{t.stats_hours}</Text>
            <Text testID='home-hours-value' style={styles.statValue}>
              {stats.hours.toFixed(1)}h
            </Text>
          </LuxuryCard>

          <LuxuryCard style={[styles.statBox, styles.statBoxGold]}>
            <Text style={[styles.statLabel, { color: COLORS.gold }]}>
              {t.stats_earnings}
            </Text>
            <Text
              testID='home-earnings-value'
              style={[styles.statValue, { color: COLORS.gold }]}
            >
              ${stats.earnings.toFixed(0)}
            </Text>
          </LuxuryCard>
        </Animated.View>

        <DailySetupModal
          visible={showSetupModal}
          onClose={() => {
            setShowSetupModal(false);
            router.setParams({ showSetup: undefined });
          }}
          onStart={handleSetupSubmit}
          mode={setupMode}
        />

        <LunchModal
          visible={showLunchModal}
          onConfirm={completeSession}
          onCancel={() => setShowLunchModal(false)}
        />

        <GlassModalWrapper visible={showSpecialCard}>
          <View testID='home-special-card' style={{ alignItems: 'center', padding: 10 }}>
            <Ionicons
              name='trophy'
              size={40}
              color={COLORS.gold}
              style={{ marginBottom: 20 }}
            />
            <Text style={styles.eggTitle}>WTracker Special Edition</Text>
            <Text style={styles.eggAuthor}>by BDevDPaz</Text>
            <View style={styles.eggDivider} />
            <Text style={styles.eggText}>
              Para uso restringido de{"\n"}
              <Text style={{ color: '#FFF' }}>Alex León</Text>
              {"\n"}
              CEO de WTracker Corp
            </Text>
            <LuxuryButton
              testID='home-special-card-close'
              text={t.btn_close || 'CERRAR'}
              onPress={() => setShowSpecialCard(false)}
              variant='outline'
              style={{ marginTop: 30 }}
            />
          </View>
        </GlassModalWrapper>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 24, paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  appTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 28,
    color: '#FFF',
    letterSpacing: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  iconBubble: {
    padding: 16,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
  },
  label: {
    fontFamily: 'Montserrat_700Bold',
    color: COLORS.textSecondary,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 8,
  },
  addressText: {
    fontFamily: 'Montserrat_600SemiBold',
    color: COLORS.textSecondary,
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 12,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceHighlight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  timerText: {
    fontFamily: 'Montserrat_600SemiBold',
    color: COLORS.gold,
    fontSize: 12,
  },
  statsContainer: { flexDirection: 'row', gap: 14 },
  statBox: {
    flex: 1,
    alignItems: 'center',
    marginBottom: 0,
  },
  statBoxGold: {
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(212,175,55,0.05)',
  },
  statLabel: {
    fontFamily: 'Montserrat_700Bold',
    color: COLORS.textSecondary,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: 'Montserrat_700Bold',
    color: '#FFF',
    fontSize: 22,
  },
  eggTitle: {
    fontFamily: 'Montserrat_700Bold',
    color: COLORS.gold,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 5,
  },
  eggAuthor: {
    fontFamily: 'Montserrat_400Regular',
    color: '#FFF',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1,
  },
  eggDivider: {
    height: 1,
    width: 50,
    backgroundColor: COLORS.border,
    marginBottom: 20,
  },
  eggText: {
    fontFamily: 'Montserrat_600SemiBold',
    color: '#AAA',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 18,
  },
});
