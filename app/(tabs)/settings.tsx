// app/(tabs)/settings.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../../src/context/LanguageContext';
import { getSettings, getDB } from '../../src/database/db';
import { scheduleDailyMorningNotification } from '../../src/services/Notifications'; // ✅ Para la alarma diaria

const ADMIN_PASSWORD = "admin123";

export default function SettingsScreen() {
  const { t, language, setLanguage } = useLanguage();

  const [form, setForm] = useState({
    employee_name: '',
    hourly_rate: '',
    employer_name: '',
    company_email: '',
    tolerance_radius: '',
    start_time: '06:00',           // ✅ Nuevo campo
    overtime_multiplier: '1.5'     // ✅ Nuevo campo
  });

  const [isAdmin, setIsAdmin] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const settings = await getSettings();
    if (settings) {
      setForm({
        employee_name: settings.employee_name || '',
        hourly_rate: settings.hourly_rate.toString(),
        employer_name: settings.employer_name,
        company_email: settings.company_email || '',
        tolerance_radius: settings.tolerance_radius.toString(),
        start_time: settings.start_time || '06:00',
        overtime_multiplier: (settings.overtime_multiplier || 1.5).toString()
      });
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    try {
      const db = getDB();
      const numericRate = parseFloat(form.hourly_rate.replace(',', '.')) || 0;
      const numericRadius = parseInt(form.tolerance_radius) || 50;
      const numericMultiplier = parseFloat(form.overtime_multiplier.replace(',', '.')) || 1.5;

      await db.runAsync(
        `UPDATE settings SET
          employee_name = ?, hourly_rate = ?,
          employer_name = ?, company_email = ?, tolerance_radius = ?,
          start_time = ?, overtime_multiplier = ?
         WHERE id = 1`,
        [
          form.employee_name, numericRate,
          form.employer_name, form.company_email, numericRadius,
          form.start_time, numericMultiplier
        ]
      );

      // ✅ Reprogramar notificación diaria
      await scheduleDailyMorningNotification();

      Alert.alert(t.btn_save, "Configuración actualizada.");
      setIsAdmin(false);
      setShowPass(false);
      setPassInput('');
    } catch (e) {
      Alert.alert("Error", "No se pudo guardar.");
    }
  };

  const unlockAdmin = () => {
    if (passInput === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowPass(false);
      setPassInput('');
    } else {
      Alert.alert("Error", t.err_pass_wrong);
    }
  };

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, value }));
  };

  if (isLoading) return <View style={styles.container} />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.header}>{t.settings_title}</Text>

          {/* SECCIÓN PÚBLICA */}
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>{t.label_lang}</Text>
              <View style={{flexDirection:'row', alignItems:'center', gap:10}}>
                <Text style={{color: language === 'es' ? '#FFF' : '#666'}}>ES</Text>
                <Switch
                  value={language === 'en'}
                  onValueChange={(val) => setLanguage(val ? 'en' : 'es')}
                  trackColor={{true: '#007AFF', false: '#333'}}
                />
                <Text style={{color: language === 'en' ? '#FFF' : '#666'}}>EN</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* ✅ Hora Recordatorio */}
            <Text style={styles.label}>{t.label_start_time}</Text>
            <TextInput
              style={styles.input}
              value={form.start_time}
              onChangeText={(t) => updateForm('start_time', t)}
              maxLength={5}
              placeholder="06:00"
              keyboardType="numbers-and-punctuation"
            />

            <TouchableOpacity style={[styles.saveBtn, {marginTop:15, backgroundColor:'#333'}]} onPress={handleSave}>
              <Text style={styles.saveBtnText}>{t.btn_save}</Text>
            </TouchableOpacity>
          </View>

          {/* ZONA ADMIN */}
          <View style={[styles.card, {borderColor: isAdmin ? '#FFD700' : '#333', borderWidth:1}]}>
            <View style={styles.row}>
              <Text style={[styles.sectionTitle, {color: isAdmin ? '#FFD700' : '#AAA'}]}>{t.admin_zone}</Text>
              {!isAdmin && !showPass && (
                <TouchableOpacity onPress={() => setShowPass(true)} style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>{t.admin_unlock}</Text>
                </TouchableOpacity>
              )}
            </View>

            {!isAdmin ? (
              showPass ? (
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, {flex:1, marginRight:10}]}
                    placeholder={t.admin_pass_placeholder}
                    placeholderTextColor="#666"
                    secureTextEntry
                    value={passInput}
                    onChangeText={setPassInput}
                    autoFocus
                  />
                  <TouchableOpacity onPress={unlockAdmin} style={styles.btnAction}>
                    <Text style={{color:'#FFF'}}>OK</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={{color:'#666', fontStyle:'italic', marginTop: 5}}>{t.admin_locked_msg}</Text>
              )
            ) : (
              <View>
                <Text style={styles.subHeader}>Datos de Empleado</Text>
                <Text style={styles.label}>{t.label_name}</Text>
                <TextInput style={[styles.input, styles.adminInput]} value={form.employee_name} onChangeText={(t) => updateForm('employee_name', t)}/>
                <Text style={styles.label}>{t.label_rate}</Text>
                <TextInput style={[styles.input, styles.adminInput]} keyboardType="decimal-pad" value={form.hourly_rate} onChangeText={(t) => updateForm('hourly_rate', t)}/>

                <View style={styles.divider} />
                <Text style={styles.subHeader}>Datos de Empresa</Text>
                <Text style={styles.label}>{t.label_company_name}</Text>
                <TextInput style={[styles.input, styles.adminInput]} value={form.employer_name} onChangeText={(t) => updateForm('employer_name', t)}/>
                <Text style={styles.label}>{t.label_report_email}</Text>
                <TextInput style={[styles.input, styles.adminInput]} value={form.company_email} onChangeText={(t) => updateForm('company_email', t)} keyboardType="email-address" autoCapitalize="none"/>
                <Text style={styles.label}>{t.label_radius}</Text>
                <TextInput style={[styles.input, styles.adminInput]} keyboardType="number-pad" value={form.tolerance_radius} onChangeText={(t) => updateForm('tolerance_radius', t)}/>

                {/* ✅ Multiplicador */}
                <Text style={styles.label}>{t.label_multiplier} (1.0, 1.5, 2.0)</Text>
                <TextInput style={[styles.input, styles.adminInput]} keyboardType="decimal-pad" value={form.overtime_multiplier} onChangeText={(t) => updateForm('overtime_multiplier', t)} placeholder="1.5"/>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}><Text style={styles.saveBtnText}>{t.btn_save}</Text></TouchableOpacity>
                <TouchableOpacity style={styles.lockBtn} onPress={() => setIsAdmin(false)}><Text style={styles.lockBtnText}>🔒 Bloquear Zona</Text></TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 20, paddingBottom: 100 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#FFF', marginBottom: 20 },
  card: { backgroundColor: '#1E1E1E', padding: 15, borderRadius: 12, marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  subHeader: { color: '#007AFF', fontWeight: 'bold', marginTop: 15, marginBottom: 5, fontSize: 14, textTransform: 'uppercase' },
  label: { color: '#AAA', marginBottom: 5, fontSize: 12, marginTop: 10 },
  input: { backgroundColor: '#333', color: '#FFF', padding: 12, borderRadius: 8, fontSize: 16 },
  adminInput: { backgroundColor: '#2a2a2a', borderColor: '#444', borderWidth: 1 },
  smallBtn: { backgroundColor: '#333', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 4 },
  smallBtnText: { color: '#AAA', fontSize: 12 },
  btnAction: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, justifyContent:'center' },
  saveBtn: { backgroundColor: '#007AFF', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 25 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  lockBtn: { marginTop: 15, alignItems: 'center', padding: 10 },
  lockBtnText: { color: '#666', fontSize: 12 },
  divider: { height: 1, backgroundColor: '#333', marginVertical: 15 }
});
