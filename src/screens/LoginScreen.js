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
  ScrollView
} from 'react-native';
import { Wrench, Shield, Mail, Lock, Server } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { setCustomApiUrl } from '../services/api';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('nikola@termoklima-sd.rs');
  const [password, setPassword] = useState('majstor123');
  const [loading, setLoading] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [showUrlConfig, setShowUrlConfig] = useState(false);

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

  const handleSaveApiUrl = async () => {
    if (customUrl.trim()) {
      await setCustomApiUrl(customUrl.trim());
      Alert.alert('Uspešno', 'API adresa je ažurirana.');
      setShowUrlConfig(false);
    }
  };

  const fillDemo = (demoEmail, demoRole) => {
    setEmail(demoEmail);
    setPassword('majstor123');
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
                  onPress={() => fillDemo('gazda@termoklima-sd.rs', 'Dispečer')}
                >
                  <Text style={[styles.demoBtnText, { color: colors.primary }]}>📊 Dispečer / Gazda</Text>
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
                  placeholder="http://192.168.1.X/majstornalog/backend/api.php"
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
    maxWidth: 420,
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
  demoSection: {
    marginTop: 24,
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
  }
});
