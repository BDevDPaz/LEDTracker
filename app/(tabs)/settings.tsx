import React, { memo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/theme';
import { LuxuryCard, LuxuryButton, LuxuryInput } from '../../src/components/ui/LuxuryUI';
import { useLuxuryUI } from '../../src/context/LuxuryUIContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { getSettings, saveSettings } from '../../src/database/db';
import { scheduleDailyMorningNotification } from '../../src/services/Notifications';
import { log } from '../../src/utils/logger';

const ADMIN_KEY = process.env.EXPO_PUBLIC_ADMIN_PIN;

function SettingsScreenComponent() {
  const router = useRouter();
  const { showToast } = useLuxuryUI();
  const { t, language, setLanguage } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAccess, setShowAccess] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [form, setForm] = useState({
    employee_name: '',
    employer_name: '',
    company_email: '',
    tolerance_radius: 200,
    hourly_rate: 25,
    start_time: '07:00',
    overtime_multiplier: 1.5,
  });

  useEffect(() => {
    const load = async () => {
      const data = await getSettings();
      if (data) {
        setForm({
          employee_name: data.employee_name,
          employer_name: data.employer_name,
          company_email: data.company_email,
          tolerance_radius: data.tolerance_radius,
          hourly_rate: data.hourly_rate,
          start_time: data.start_time,
          overtime_multiplier: data.overtime_multiplier,
        });
      }
      setIsLoading(false);
    };
    void load();
  }, []);

  const handleSave = async () => {
    try {
      await saveSettings({
        ...form,
        language,
        id: 1,
      });
      log('VERDE', 'OPERACION_EXITOSA', 'INFO', 'Configuración actualizada correctamente');
      showToast('Configuración guardada', 'success');

      // Re-programar notificación si cambió la hora
      await scheduleDailyMorningNotification();

      setIsAdmin(false);
      setShowAccess(false);
      setPinInput('');
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error al guardar la configuración', e);
      showToast('Error al guardar la configuración', 'error');
    }
  };

  const unlockAdmin = () => {
    if (ADMIN_KEY && pinInput === ADMIN_KEY) {
      log('AZUL', 'PERMISOS_CONCEDIDOS', 'INFO', 'Zona administrativa desbloqueada correctamente');
      setIsAdmin(true);
      setShowAccess(false);
      setPinInput('');
    } else {
      log('AMARILLO', 'ADVERTENCIA', 'WARN', 'Intento de acceso administrativo fallido (PIN incorrecto)');
      showToast(t.err_access_denied || 'Contraseña incorrecta', 'error');
    }
  };

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) return <View style={styles.container} />;

  return (
    <SafeAreaView testID='settings-screen' style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)')}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Volver al Inicio"
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.gold} />
            <Text style={styles.backText}>INICIO</Text>
          </TouchableOpacity>
          <Text style={styles.header}>{t.settings_title}</Text>
        </View>

        <ScrollView testID='settings-scroll-view' contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.headerContainer}>
            <Text style={styles.subHeaderLabel}>PREFERENCIAS GENERALES</Text>
          </View>

          {/* CARD PREFERENCIAS */}
          <LuxuryCard style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconRow}>
                 <Ionicons name='globe-outline' size={20} color={COLORS.gold} />
                 <Text style={styles.label}>{t.label_lang}</Text>
              </View>
              <View style={styles.toggleBox}>
                <Text style={[styles.langText, language === 'es' && styles.langActive]}>ES</Text>
                <Switch
                  testID='settings-language-switch'
                  value={language === 'en'}
                  onValueChange={(val) => setLanguage(val ? 'en' : 'es')}
                  trackColor={{true: COLORS.gold, false: '#333'}}
                  thumbColor='#FFF'
                />
                <Text style={[styles.langText, language === 'en' && styles.langActive]}>EN</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <LuxuryInput
              testID='settings-reminder-time'
              label={t.label_start_time}
              icon={<Ionicons name='alarm-outline' size={20} color={COLORS.gold} />}
              value={form.start_time}
              onChangeText={(text: string) => updateForm('start_time', text)}
              maxLength={5}
              keyboardType='numbers-and-punctuation'
            />

            <LuxuryButton
              testID='settings-save-button'
              text={t.btn_save}
              onPress={handleSave}
              variant='secondary'
              style={{ marginTop: 10 }}
            />
          </LuxuryCard>

          {/* ZONA ADMIN */}
          <View style={styles.headerContainer}>
             <Text style={styles.subHeaderLabel}>ZONA ADMINISTRATIVA</Text>
          </View>

          <LuxuryCard active={isAdmin} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconRow}>
                  <Ionicons
                    name={isAdmin ? 'lock-open' : 'lock-closed'}
                    size={20}
                    color={isAdmin ? COLORS.gold : COLORS.textSecondary}
                  />
                  <Text style={[styles.label, isAdmin && {color: COLORS.gold}]}>
                    {t.admin_zone}
                  </Text>
              </View>
              {!isAdmin && !showAccess && (
                <TouchableOpacity testID='settings-admin-unlock' onPress={() => setShowAccess(true)} style={styles.unlockBtn}>
                    <Text style={styles.unlockBtnText}>{t.admin_unlock}</Text>
                </TouchableOpacity>
              )}
            </View>

            {!isAdmin ? (
              showAccess ? (
                <View style={styles.pinRow}>
                  <LuxuryInput
                    testID='settings-admin-pin'
                    placeholder={t.admin_access_key_placeholder}
                    secureTextEntry
                    value={pinInput}
                    onChangeText={setPinInput}
                    autoFocus
                    containerStyle={{ flex: 1, marginBottom: 0 }}
                  />
                  <TouchableOpacity testID='settings-admin-ok' onPress={unlockAdmin} style={styles.okBtn}>
                    <Ionicons name='arrow-forward' color='#000' size={20} />
                  </TouchableOpacity>
                </View>
              ) : <Text style={styles.lockedMsg}>{t.admin_locked_msg}</Text>
            ) : (
              <View style={{marginTop: 20}}>
                <Text style={styles.groupTitle}>INFORMACIÓN DEL EMPLEADO</Text>
                <LuxuryInput
                  testID='settings-employee-name'
                  label={t.label_name}
                  value={form.employee_name}
                  onChangeText={(t: string) => updateForm('employee_name', t)}
                  placeholder='Nombre Completo'
                />
                <LuxuryInput
                  testID='settings-hourly-rate'
                  label={t.label_rate}
                  value={String(form.hourly_rate)}
                  onChangeText={(t: string) => updateForm('hourly_rate', t)}
                  keyboardType='decimal-pad'
                  placeholder='0.00'
                  icon={<Text style={{ color: COLORS.gold, fontFamily: 'Montserrat_700Bold' }}>$</Text>}
                />

                <Text style={styles.groupTitle}>DATOS DE LA EMPRESA</Text>
                <LuxuryInput
                  testID='settings-company-name'
                  label={t.label_company_name}
                  value={form.employer_name}
                  onChangeText={(t: string) => updateForm('employer_name', t)}
                />
                <LuxuryInput
                  testID='settings-company-email'
                  label={t.label_report_email}
                  value={form.company_email}
                  onChangeText={(t: string) => updateForm('company_email', t)}
                  keyboardType='email-address'
                  autoCapitalize='none'
                  icon={<Ionicons name='mail-outline' size={18} color={COLORS.gold} />}
                />

                <Text style={styles.groupTitle}>PARÁMETROS TÉCNICOS</Text>
                <View style={{flexDirection:'row', gap:10}}>
                   <LuxuryInput
                     testID='settings-radius'
                     label='RADIO (M)'
                     containerStyle={{flex:1}}
                     value={String(form.tolerance_radius)}
                     onChangeText={(t: string) => updateForm('tolerance_radius', t)}
                     keyboardType='number-pad'
                   />
                   <LuxuryInput
                     testID='settings-multiplier'
                     label='MULT. OT'
                     containerStyle={{flex:1}}
                     value={String(form.overtime_multiplier)}
                     onChangeText={(t: string) => updateForm('overtime_multiplier', t)}
                     keyboardType='decimal-pad'
                   />
                </View>

                <LuxuryButton
                  testID='settings-admin-save'
                  text={t.btn_save}
                  onPress={handleSave}
                  variant='primary'
                  style={{ marginTop: 10 }}
                />

                <TouchableOpacity testID='settings-admin-lock' style={styles.lockBtn} onPress={() => setIsAdmin(false)}>
                  <Text style={styles.lockBtnText}>BLOQUEAR ACCESO</Text>
                </TouchableOpacity>
              </View>
            )}
          </LuxuryCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 24, paddingBottom: 100 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    gap: 16
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceHighlight,
    paddingRight: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  backText: {
    fontFamily: 'Montserrat_700Bold',
    color: COLORS.gold,
    fontSize: 10,
    letterSpacing: 1,
  },
  headerContainer: { marginBottom: 12 },
  header: { fontFamily: 'Montserrat_300Light', fontSize: 32, color: '#FFF' },
  subHeaderLabel: { fontFamily: 'Montserrat_700Bold', color: COLORS.textSecondary, fontSize: 10, letterSpacing: 2, marginTop: 4, textTransform: 'uppercase' },
  card: { marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontFamily: 'Montserrat_600SemiBold', color: '#FFF', fontSize: 14 },
  toggleBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langText: { fontFamily: 'Montserrat_700Bold', fontSize: 10, color: '#444' },
  langActive: { color: '#FFF' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 20 },
  unlockBtn: { backgroundColor: COLORS.goldDim, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  unlockBtnText: { fontFamily: 'Montserrat_700Bold', color: COLORS.gold, fontSize: 10, textTransform: 'uppercase' },
  pinRow: { flexDirection: 'row', marginTop: 15, gap: 10, alignItems: 'center' },
  okBtn: { backgroundColor: COLORS.gold, width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  lockedMsg: { fontFamily: 'Montserrat_400Regular', color: '#444', fontStyle: 'italic', marginTop: 10, fontSize: 12 },
  groupTitle: { fontFamily: 'Montserrat_700Bold', color: COLORS.gold, fontSize: 10, marginTop: 25, marginBottom: 12, letterSpacing: 1, opacity: 0.8 },
  lockBtn: { alignItems: 'center', padding: 15, marginTop: 10 },
  lockBtnText: { fontFamily: 'Montserrat_700Bold', color: '#444', fontSize: 10, letterSpacing: 1 }
});

export default memo(SettingsScreenComponent);
