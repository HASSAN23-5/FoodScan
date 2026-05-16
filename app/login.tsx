import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      router.replace('/(tabs)');
    } else {
      setError(result.error || 'Erreur de connexion');
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    const result = await loginWithGoogle();
    // On web, this function navigates away; we'll never reach the next line.
    // On native, we return here.
    setGoogleLoading(false);
    if (result.success) {
      router.replace('/(tabs)');
    } else if (result.error) {
      setError(result.error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Decorative top blob */}
          <View style={styles.topBlob} />

          {/* Logo */}
          <View style={styles.logoSection}>
            <View style={styles.logoIcon}>
              <Ionicons name="leaf" size={42} color={Colors.white} />
            </View>
            <Text style={styles.logoText}>FoodScan</Text>
            <Text style={styles.tagline}>Scannez plus, mangez mieux.</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Connexion</Text>
            <Text style={styles.cardSubtitle}>Connectez-vous pour accéder à votre historique et vos objectifs</Text>

            {/* Google OAuth */}
            <TouchableOpacity
              style={[styles.googleBtn, googleLoading && { opacity: 0.7 }]}
              onPress={handleGoogleLogin}
              activeOpacity={0.7}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color={Colors.foreground} />
              ) : (
                <>
                  <Image
                    source={{ uri: 'https://www.google.com/favicon.ico' }}
                    style={{ width: 20, height: 20, marginRight: 10 }}
                  />
                  <Text style={styles.googleBtnText}>Continuer avec Google</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={20} color={Colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="vous@exemple.com"
                placeholderTextColor={Colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password */}
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>Se connecter</Text>
                  <Ionicons name="arrow-forward" size={18} color={Colors.white} style={{ marginLeft: 6 }} />
                </>
              )}
            </TouchableOpacity>

            {/* Register Link */}
            <View style={styles.linkRow}>
              <Text style={styles.linkText}>Pas de compte ? </Text>
              <TouchableOpacity onPress={() => router.push('/register')}>
                <Text style={styles.linkBold}>S'inscrire</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  keyboardView: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, position: 'relative' },
  topBlob: {
    position: 'absolute', top: -120, right: -80, width: 280, height: 280, borderRadius: 140,
    backgroundColor: Colors.secondary, opacity: 0.55,
  },
  logoSection: { alignItems: 'center', marginBottom: 32 },
  logoIcon: {
    width: 78, height: 78, borderRadius: 22,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 18, elevation: 6,
  },
  logoText: { fontSize: 34, fontWeight: '800', color: Colors.foreground, letterSpacing: -0.5 },
  tagline: { fontSize: 15, color: Colors.mutedForeground, marginTop: 6 },
  card: {
    backgroundColor: Colors.card, borderRadius: 28, padding: 26,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08, shadowRadius: 28, elevation: 6,
  },
  cardTitle: { fontSize: 26, fontWeight: '700', color: Colors.foreground, marginBottom: 6 },
  cardSubtitle: { fontSize: 14, color: Colors.mutedForeground, marginBottom: 20, lineHeight: 20 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 50, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card,
  },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: Colors.foreground },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: 12, fontSize: 13, color: Colors.mutedForeground },
  label: { fontSize: 14, fontWeight: '600', color: Colors.foreground, marginBottom: 6, marginTop: 12 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    height: 50, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: Colors.foreground },
  eyeBtn: { padding: 4 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 12, padding: 12, marginTop: 16,
  },
  errorText: { color: '#DC2626', fontSize: 13, flex: 1 },
  submitBtn: {
    flexDirection: 'row',
    height: 54, borderRadius: 27, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 22,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  linkText: { fontSize: 14, color: Colors.mutedForeground },
  linkBold: { fontSize: 14, fontWeight: '700', color: Colors.primary },
});
