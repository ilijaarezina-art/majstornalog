import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal
} from 'react-native';
import { Wrench, Shield, Mail, Lock, Server, UserPlus, X, Phone, User } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { setCustomApiUrl, api } from '../services/api';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('nikola@termoklima-sd.rs');
  const [password, setPassword] = useState('majstor123');
  const [loading, setLoading] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [showUrlConfig, setShowUrlConfig] = useState(false);

  // Registracija novog korisnika
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regForm, setRegForm] = useState({
    ime: '',
    prezime: '',
    email: '',
    telefon: '',
    lozinka: ''
  });
  const [registering, setRegistering] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Upozorenje', 'Unesite email i lozinku.');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      Alert.alert('Neuspešna prijava', err.message || 'Proverite podatke ili server konekciju.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!regForm.ime.trim() || !regForm.email.trim() || !regForm.lozinka.trim()) {
      Alert.alert('Upozorenje', 'Ime, email i lozinka su obavezna polja.');
      return;
    }
    setRegistering(true);
    try {
      const res = await api.register(regForm);
      Alert.alert(
        'Uspešna registracija',
        res?.poruka || 'Vaš nalog je kreiran kao običan korisnik (ID role 3). SuperAdministrator će Vam dodeliti ulogu administratora i servis pre nego što se prijavite.'
      );
      setEmail(regForm.email);
      setPassword(regForm.lozinka);
      setShowRegisterModal(false);
      setRegForm({ ime: '', prezime: '', email: '', telefon: '', lozinka: '' });
    } catch (err) {
      Alert.alert('Greška pri registraciji', err.message || 'Nije moguće završiti registraciju.');
    } finally {
      setRegistering(false);
    }
  };

  const handleSaveApiUrl = async () => {
    if (customUrl.trim()) {
      await setCustomApiUrl(customUrl.trim());
      Alert.alert('Uspešno', 'API adresa je ažurirana.');
      setShowUrlConfig(false);
    }
  };

  const fillDemo = (demoEmail, demoRole) => {
    setEmail(demoEmail);
    setPassword(demoRole === 'SuperAdmin' ? 'admin123' : 'majstor123');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          {/* Logo / Brand Header */}
          <View style={styles.logoWrap}>
            <View style={styles.logoCircle}>
              <Wrench size={36} color="#FFFFFF" />
            </View>
            <Text style={styles.appName}>MajstorNalog</Text>
            <Text style={styles.appTagline}>Sistem za upravljanje terenskim radnim nalozima</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>Email adresa</Text>
            <View style={styles.inputWrap}>
              <Mail size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Unesite email"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={[styles.label, { marginTop: 14 }]}>Lozinka</Text>
            <View style={styles.inputWrap}>
              <Lock size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Unesite lozinku"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginBtnText}>Prijavi se na sistem</Text>
              )}
            </TouchableOpacity>

            {/* Dugme za registraciju novog korisnika */}
            <TouchableOpacity
              style={styles.registerToggleBtn}
              onPress={() => setShowRegisterModal(true)}
              activeOpacity={0.8}
            >
              <UserPlus size={16} color="#38BDF8" style={{ marginRight: 6 }} />
              <Text style={styles.registerToggleBtnText}>
                Nemate nalog? <Text style={{ textDecorationLine: 'underline', fontWeight: '800' }}>Registrujte se ovde</Text>
              </Text>
            </TouchableOpacity>

            {/* Demo Quick-Fill Buttons */}
            <View style={styles.demoSection}>
              <Text style={styles.demoTitle}>Brza demo prijava:</Text>
              <View style={styles.demoButtonsRow}>
                <TouchableOpacity
                  style={styles.demoBtn}
                  onPress={() => fillDemo('nikola@termoklima-sd.rs', 'Majstor 1')}
                >
                  <Text style={styles.demoBtnText}>🔧 Majstor Nikola</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.demoBtn}
                  onPress={() => fillDemo('milan@termoklima-sd.rs', 'Majstor 2')}
                >
                  <Text style={styles.demoBtnText}>🔧 Majstor Milan</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.demoBtn, { backgroundColor: '#EFF6FF', borderColor: colors.primary }]}
                  onPress={() => fillDemo('gazda@termoklima-sd.rs', 'Admin servisa')}
                >
                  <Text style={[styles.demoBtnText, { color: colors.primary }]}>🏢 Admin servisa / Gazda</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.demoBtn, { backgroundColor: '#FAF5FF', borderColor: '#9333EA' }]}
                  onPress={() => fillDemo('admin@majstornalog.rs', 'SuperAdmin')}
                >
                  <Text style={[styles.demoBtnText, { color: '#7E22CE' }]}>👑 SuperAdmin (Upravljanje servisima & ulogama)</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Server Config Toggle */}
            <TouchableOpacity
              style={styles.configToggle}
              onPress={() => setShowUrlConfig(!showUrlConfig)}
            >
              <Server size={14} color="#94A3B8" style={{ marginRight: 6 }} />
              <Text style={styles.configToggleText}>Podešavanje API servera</Text>
            </TouchableOpacity>

            {showUrlConfig && (
              <View style={styles.configBox}>
                <TextInput
                  style={styles.configInput}
                  placeholder="https://bookmymusic.rs/majstornalog/api.php"
                  value={customUrl}
                  onChangeText={setCustomUrl}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.configSaveBtn} onPress={handleSaveApiUrl}>
                  <Text style={styles.configSaveBtnText}>Sačuvaj URL</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* MODAL ZA JAVNU REGISTRACIJU */}
      <Modal visible={showRegisterModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <UserPlus size={20} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Registracija novog korisnika</Text>
              </View>
              <TouchableOpacity onPress={() => setShowRegisterModal(false)}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingVertical: 12, gap: 10 }}>
              <Text style={styles.modalNoticeText}>
                Nakon registracije Vaš nalog dobija status <Text style={{ fontWeight: '800', color: '#0284C7' }}>Običnog korisnika (ID role 3)</Text>. SuperAdministrator će Vam dodeliti ulogu Administratora servisa (ID role 2) i povezati Vaš servis pre nego što počnete sa radom.
              </Text>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Ime *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Petar"
                    placeholderTextColor="#64748B"
                    value={regForm.ime}
                    onChangeText={(t) => setRegForm({ ...regForm, ime: t })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Prezime</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Jovanović"
                    placeholderTextColor="#64748B"
                    value={regForm.prezime}
                    onChangeText={(t) => setRegForm({ ...regForm, prezime: t })}
                  />
                </View>
              </View>

              <Text style={styles.modalLabel}>Email adresa (Korisničko ime) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="petar@mojservis.rs"
                placeholderTextColor="#64748B"
                value={regForm.email}
                onChangeText={(t) => setRegForm({ ...regForm, email: t })}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.modalLabel}>Broj telefona</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="064-111-222"
                placeholderTextColor="#64748B"
                value={regForm.telefon}
                onChangeText={(t) => setRegForm({ ...regForm, telefon: t })}
              />

              <Text style={styles.modalLabel}>Lozinka *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Izaberite lozinku"
                placeholderTextColor="#64748B"
                value={regForm.lozinka}
                onChangeText={(t) => setRegForm({ ...regForm, lozinka: t })}
                secureTextEntry
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowRegisterModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Odustani</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, registering && { opacity: 0.7 }]}
                onPress={handleRegister}
                disabled={registering}
              >
                {registering ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Registruj se</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A'
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 24
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10
  },
  appName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5
  },
  appTagline: {
    fontSize: 12.5,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center'
  },
  form: {
    width: '100%'
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 6
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48
  },
  inputIcon: {
    marginRight: 10
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14
  },
  loginBtn: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8
  },
  loginBtnDisabled: {
    opacity: 0.7
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800'
  },
  registerToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 6
  },
  registerToggleBtnText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600'
  },
  demoSection: {
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  demoTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  demoButtonsRow: {
    flexDirection: 'column',
    gap: 8
  },
  demoBtn: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  demoBtnText: {
    color: '#E2E8F0',
    fontSize: 12.5,
    fontWeight: '700'
  },
  configToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18
  },
  configToggleText: {
    fontSize: 11,
    color: '#94A3B8'
  },
  configBox: {
    marginTop: 10,
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  configInput: {
    color: '#FFFFFF',
    fontSize: 12,
    padding: 6,
    backgroundColor: '#1E293B',
    borderRadius: 6,
    marginBottom: 8
  },
  configSaveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center'
  },
  configSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },

  // Modal za registraciju
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContent: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  modalNoticeText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    marginTop: 4
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 13,
    marginTop: 4
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    marginTop: 10
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#334155'
  },
  modalCancelBtnText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700'
  },
  modalSubmitBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary
  },
  modalSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  }
});
