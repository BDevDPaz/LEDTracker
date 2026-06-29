import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native-reanimated';

import { engine } from '../../src/engine/workTrackerEngine';
import { selectActiveSession, selectIsLoading } from '../../src/engine/selectors/workTrackerSelectors';
import { sessionStoreAdapter } from '../../src/runtime/sessionStoreAdapter';
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

export default function HomeScreen() {
  const { t } = useLanguage();
  const { showToast } = useLuxuryUI();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Engine state
  const [engineState, setEngineState] = useState(engine.getState());

  const activeSession = selectActiveSession(engineState);
  const isProcessing = selectIsLoading(engineState);

  const [address, setAddress] = useState<string>('Cargando...');
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
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    engine.dispatch({ type: 'APP_INIT' });
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const history = await sessionStoreAdapter.getHistory();
      const settings = await sessionStoreAdapter.getSettings();
      const rate = settings?.hourly_rate || 0;

      let totalH = 0;
      history.forEach((s) => {
        if (s.start_time && s.end_time) {
          totalH += (s.end_time - s.start_time) / 3600000;
        }
      });
      setStats({ hours: totalH, earnings: totalH * rate });
    } catch (_e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error cargando estadísticas', _e);
    }
  }, []);

  useEffect(() => {
    void loadStats();
    if (activeSession) {
      setAddress(activeSession.address);
    } else {
      setAddress(t.no_activity || 'No hay actividad registrada.');
    }
  }, [activeSession, loadStats, t.no_activity]);

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
    engine.dispatch({ type: 'APP_INIT' });
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  const handleSetupSubmit = async (addr: string, client: string, notes: string) => {
    setShowSetupModal(false);
    engine.dispatch({ type: 'START_SESSION_REQUEST', address: addr, client, notes });
  };

  const handleClockOut = () => {
    setShowLunchModal(true);
  };

  const completeSession = async (lunchMinutes: number) => {
    setShowLunchModal(false);
    engine.dispatch({ type: 'STOP_SESSION_REQUEST', lunchMinutes });
    showToast(t.toast_shift_ended || 'Jornada finalizada', 'success');
  };

  const handleEasterEggTap = () => {
    setTapCount((prev) => prev + 1);
    iconScale.value = withSequence(withSpring(1.5), withSpring(1));

    if (tapCount + 1 >= 7) {
      setShowSpecialCard(true);
      setTapCount(0);
    }
  };

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const getStatusColor = () => {
    if (!activeSession) return COLORS.textSecondary;
    if (activeSession.status === 'active') return COLORS.success;
    if (activeSession.status === 'pending_arrival') return '#f59e0b';
    return COLORS.gold;
  };

  const getStatusIcon = () => {
    if (!activeSession) return 'pause-circle-outline';
    if (activeSession.status === 'active') return 'checkmark-circle';
    if (activeSession.status === 'pending_arrival') return 'navigate-circle';
    return 'car-outline';
  };

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
        <View testID='home-header' style={styles.header}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text testID='home-title' style={styles.appTitle}>
                {t.header_title || 'LED Tracker'}
              </Text>
              <TouchableOpacity
                testID='home-easter-egg-trigger'
                onPress={handleEasterEggTap}
                activeOpacity={0.8}
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
        </View>

        <View testID='home-card-wrapper'>
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
                  {address}
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
        </View>

        <View testID='home-primary-action-wrapper'>
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
        </View>

        <View testID='home-stats-container' style={styles.statsContainer}>
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
        </View>

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
            <Text style={styles.eggTitle}>LED Tracker Special Edition</Text>
            <Text style={styles.eggAuthor}>by BDevDPaz</Text>
            <View style={styles.eggDivider} />
            <Text style={styles.eggText}>
              Para uso restringido de{"\n"}
              <Text style={{ color: '#FFF' }}>Alex León</Text>
              {"\n"}
              CEO de LEON&apos;S ELECTRICAL DESIGN
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