import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../src/context/LanguageContext';
import { getSettings, getDB } from '../../src/database/db';
import { scheduleDailyMorningNotification } from '../../src/services/Notifications';
import { COLORS } from '../../src/constants/theme';
import { useLuxuryUI } from '../../src/context/LuxuryUIContext';

const ADMIN_PASSWORD = "admin123";

export default function SettingsScreen() {
  const { t, language, setLanguage } = useLanguage();
  const { showToast } = useLuxuryUI();
  const [form, setForm] = useState({ employee_name: '', hourly_rate: '', employer_name: '', company_email: '', tolerance_radius: '', start_time: '06:00', overtime_multiplier: '1.5' });
  const [isAdmin, setIsAdmin] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const settings = await getSettings();
      if (settings) {
        setForm({
          employee_name: settings.employee_name || '',
          hourly_rate: settings.hourly_rate ? settings.hourly_rate.toString() : '',
          employer_name: settings.employer_name || '',
          company_email: settings.company_email || '',
          tolerance_radius: settings.tolerance_radius ? settings.tolerance_radius.toString() : '50',
          start_time: settings.start_time || '06:00',
          overtime_multiplier: settings.overtime_multiplier ? settings.overtime_multiplier.toString() : '1.5'
        });
      }
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const handleSave = async () => {
    try {
      const db = getDB();
      const numericRate = parseFloat(form.hourly_rate.replace(',', '.')) || 0;
      const numericRadius = parseInt(form.tolerance_radius) || 50;
      const numericMultiplier = parseFloat(form.overtime_multiplier.replace(',', '.')) || 1.5;

      await db.runAsync(`UPDATE settings SET employee_name = ?, hourly_rate = ?, employer_name = ?, company_email = ?, tolerance_radius = ?, start_time = ?, overtime_multiplier = ? WHERE id = 1`,
        [form.employee_name, numericRate, form.employer_name, form.company_email, numericRadius, form.start_time, numericMultiplier]
      );
      await scheduleDailyMorningNotification();
      showToast("Configuración guardada correctamente", "success");
      setIsAdmin(false); setShowPass(false); setPassInput('');
    } catch (e) { 
      console.error(e); 
      showToast("Error al guardar la configuración", "error");
    }
  };

  const unlockAdmin = () => {
    if (passInput === ADMIN_PASSWORD) { setIsAdmin(true); setShowPass(false); setPassInput(''); } 
    else { showToast(t.err_pass_wrong || "Contraseña incorrecta", "error"); }
  };

  const updateForm = (key: keyof typeof form, value: string) => { setForm(prev => ({ ...prev, [key]: value })); };

  if (isLoading) return <View style={styles.container} />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView 
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.header}>{t.settings_title}</Text>
          <Text style={styles.subHeaderLabel}>PREFERENCIAS</Text>

          {/* CARD PREFERENCIAS */}
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconRow}>
                 <Ionicons name="globe-outline" size={20} color={COLORS.textSecondary} />
                 <Text style={styles.label}>{t.label_lang}</Text>
              </View>
              <View style={styles.toggleBox}>
                <Text style={[styles.langText, language === 'es' && styles.langActive]}>ES</Text>
                <Switch
                  value={language === 'en'}
                  onValueChange={(val) => setLanguage(val ? 'en' : 'es')}
                  trackColor={{true: COLORS.gold, false: '#333'}}
                  thumbColor="#FFF"
                />
                <Text style={[styles.langText, language === 'en' && styles.langActive]}>EN</Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.row}>
               <View style={styles.iconRow}>
                 <Ionicons name="alarm-outline" size={20} color={COLORS.textSecondary} />
                 <Text style={styles.label}>{t.label_start_time}</Text>
               </View>
               <TextInput 
                  style={styles.timeInput} 
                  value={form.start_time} 
                  onChangeText={(text) => updateForm('start_time', text)} 
                  maxLength={5} 
                  keyboardType="numbers-and-punctuation"
                />
            </View>
            
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>{t.btn_save}</Text>
            </TouchableOpacity>
          </View>

          {/* CARD ADMIN */}
          <Text style={[styles.subHeaderLabel, {marginTop: 20}]}>ZONA ADMINISTRATIVA</Text>
          <View style={[styles.card, isAdmin && styles.cardAdminActive]}>
            <View style={styles.row}>
              <View style={styles.iconRow}>
                  <Ionicons name={isAdmin ? "lock-open" : "lock-closed"} size={20} color={isAdmin ? COLORS.gold : COLORS.textSecondary} />
                  <Text style={[styles.label, isAdmin && {color: COLORS.gold}]}>{t.admin_zone}</Text>
              </View>
              {!isAdmin && !showPass && (
                <TouchableOpacity onPress={() => setShowPass(true)} style={styles.unlockBtn}>
                    <Text style={styles.unlockBtnText}>{t.admin_unlock}</Text>
                </TouchableOpacity>
              )}
            </View>

            {!isAdmin ? (
              showPass ? (
                <View style={styles.passRow}>
                  <TextInput 
                    style={styles.inputPass} 
                    placeholder={t.admin_pass_placeholder} 
                    placeholderTextColor="#444" 
                    secureTextEntry 
                    value={passInput} 
                    onChangeText={setPassInput} 
                    autoFocus
                  />
                  <TouchableOpacity
                    onPress={unlockAdmin}
                    style={styles.okBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Desbloquear zona administrativa"
                  >
                    <Ionicons name="arrow-forward" color="#000" size={20} />
                  </TouchableOpacity>
                </View>
              ) : <Text style={styles.lockedMsg}>{t.admin_locked_msg}</Text>
            ) : (
              <View style={{marginTop: 20}}>
                <Text style={styles.groupTitle}>EMPLEADO</Text>
                <TextInput style={styles.input} placeholder={t.label_name} placeholderTextColor="#444" value={form.employee_name} onChangeText={(t) => updateForm('employee_name', t)}/>
                <TextInput style={styles.input} placeholder={t.label_rate} placeholderTextColor="#444" keyboardType="decimal-pad" value={form.hourly_rate} onChangeText={(t) => updateForm('hourly_rate', t)}/>

                <Text style={styles.groupTitle}>EMPRESA</Text>
                <TextInput style={styles.input} placeholder={t.label_company_name} placeholderTextColor="#444" value={form.employer_name} onChangeText={(t) => updateForm('employer_name', t)}/>
                <TextInput style={styles.input} placeholder={t.label_report_email} placeholderTextColor="#444" value={form.company_email} onChangeText={(t) => updateForm('company_email', t)} keyboardType="email-address" autoCapitalize="none"/>
                
                <Text style={styles.groupTitle}>TÉCNICO</Text>
                <View style={{flexDirection:'row', gap:10}}>
                   <TextInput style={[styles.input, {flex:1}]} placeholder="Radio (m)" placeholderTextColor="#444" keyboardType="number-pad" value={form.tolerance_radius} onChangeText={(t) => updateForm('tolerance_radius', t)}/>
                   <TextInput style={[styles.input, {flex:1}]} placeholder="Mult. (1.5)" placeholderTextColor="#444" keyboardType="decimal-pad" value={form.overtime_multiplier} onChangeText={(t) => updateForm('overtime_multiplier', t)}/>
                </View>

                <TouchableOpacity style={styles.saveBtnGold} onPress={handleSave}><Text style={styles.saveBtnTextDark}>{t.btn_save}</Text></TouchableOpacity>
                <TouchableOpacity style={styles.lockBtn} onPress={() => setIsAdmin(false)}><Text style={styles.lockBtnText}>Bloquear</Text></TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 24, paddingBottom: 100 },
  header: { fontFamily: 'Montserrat_300Light', fontSize: 32, color: '#FFF' },
  subHeaderLabel: { fontFamily: 'Montserrat_700Bold', color: COLORS.textSecondary, fontSize: 10, letterSpacing: 2, marginBottom: 10, marginTop: 4 },
  
  card: { backgroundColor: COLORS.surface, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border },
  cardAdminActive: { borderColor: COLORS.goldDim, backgroundColor: '#0f0f0f' },
  
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontFamily: 'Montserrat_600SemiBold', color: '#FFF', fontSize: 14 },
  toggleBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langText: { fontFamily: 'Montserrat_700Bold', fontSize: 10, color: '#444' },
  langActive: { color: '#FFF' },
  timeInput: { fontFamily: 'Montserrat_700Bold', color: COLORS.gold, fontSize: 16, borderBottomWidth:1, borderBottomColor: COLORS.border, padding: 5, minWidth: 60, textAlign:'center' },
  
  saveBtn: { backgroundColor: '#1A1A1A', padding: 15, borderRadius: 16, alignItems: 'center', marginTop: 20 },
  saveBtnGold: { backgroundColor: COLORS.gold, padding: 15, borderRadius: 16, alignItems: 'center', marginTop: 20 },
  saveBtnText: { fontFamily: 'Montserrat_700Bold', color: '#FFF', fontSize: 12, letterSpacing: 1 },
  saveBtnTextDark: { fontFamily: 'Montserrat_700Bold', color: '#000', fontSize: 12, letterSpacing: 1 },
  
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 20 },
  
  // Admin styles
  unlockBtn: { backgroundColor: COLORS.goldDim, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  unlockBtnText: { fontFamily: 'Montserrat_700Bold', color: COLORS.gold, fontSize: 10 },
  passRow: { flexDirection: 'row', marginTop: 15, gap: 10 },
  inputPass: { fontFamily: 'Montserrat_400Regular', flex: 1, backgroundColor: '#000', color: '#FFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  okBtn: { backgroundColor: COLORS.gold, width: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  lockedMsg: { fontFamily: 'Montserrat_400Regular', color: '#444', fontStyle: 'italic', marginTop: 10, fontSize: 12 },
  
  groupTitle: { fontFamily: 'Montserrat_700Bold', color: COLORS.textSecondary, fontSize: 10, marginTop: 15, marginBottom: 5, letterSpacing: 1 },
  input: { fontFamily: 'Montserrat_400Regular', backgroundColor: '#000', color: '#FFF', padding: 14, borderRadius: 12, fontSize: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  lockBtn: { alignItems: 'center', padding: 15 },
  lockBtnText: { fontFamily: 'Montserrat_400Regular', color: '#666', fontSize: 12 }
});
