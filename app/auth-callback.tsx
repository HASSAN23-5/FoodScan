import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import api from '../services/api';
import { saveToken, saveUser } from '../services/storage';
import { useAuth } from '../context/AuthContext';

/**
 * AUTH CALLBACK ROUTE
 * ===================
 * This route is hit by the Emergent OAuth flow after the user authenticates with Google.
 *
 * Flow on WEB (the case that was breaking):
 *  1. User clicks "Continue with Google" on /login
 *  2. Browser navigates to https://auth.emergentagent.com/?redirect=http://localhost:8081/auth-callback
 *  3. User completes Google login
 *  4. Browser is redirected to http://localhost:8081/auth-callback#session_id=XXXX
 *  5. THIS SCREEN runs: reads session_id from URL hash, exchanges it for a JWT, redirects to /(tabs)
 *
 * Flow on MOBILE: WebBrowser.openAuthSessionAsync catches the redirect itself and AuthContext
 * handles the exchange inline. This route is a safety net if the deep link reopens the app.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // Extract session_id from URL fragment (#session_id=...) or query (?session_id=...)
        let sessionId: string | null = null;

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const hash = window.location.hash || '';
          const search = window.location.search || '';

          const hashMatch = hash.match(/session_id=([^&]+)/);
          if (hashMatch) sessionId = decodeURIComponent(hashMatch[1]);

          if (!sessionId) {
            const params = new URLSearchParams(search);
            const fromQuery = params.get('session_id');
            if (fromQuery) sessionId = fromQuery;
          }
        }

        if (!sessionId) {
          setStatus('error');
          setErrorMsg("Identifiant de session introuvable dans l'URL.");
          return;
        }

        // Exchange session_id for our JWT via the backend
        const { data } = await api.post('/auth/session', { session_id: sessionId });

        if (!data?.access_token) {
          setStatus('error');
          setErrorMsg("Le serveur n'a pas renvoyé de jeton d'accès.");
          return;
        }

        // Persist tokens + user
        await saveToken(data.access_token, data.refresh_token);
        await saveUser({
          user_id: data.user_id,
          email: data.email,
          name: data.name,
          role: data.role,
          picture: data.picture,
        });

        // Refresh the AuthContext so the rest of the app sees the user
        await refreshUser();

        // Clean the URL hash so a reload doesn't replay the flow
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history?.replaceState) {
          try {
            window.history.replaceState(null, '', '/');
          } catch {}
        }

        router.replace('/(tabs)');
      } catch (e: any) {
        const detail = e?.response?.data?.detail;
        setStatus('error');
        setErrorMsg(
          typeof detail === 'string'
            ? detail
            : "La connexion Google a échoué. Vérifiez que le backend tourne et réessayez."
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        {status === 'loading' ? (
          <>
            <View style={styles.iconBox}>
              <Ionicons name="leaf" size={36} color={Colors.white} />
            </View>
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 24 }} />
            <Text style={styles.title}>Connexion en cours…</Text>
            <Text style={styles.subtitle}>Finalisation de votre authentification Google</Text>
          </>
        ) : (
          <>
            <View style={[styles.iconBox, { backgroundColor: Colors.destructive }]}>
              <Ionicons name="alert" size={36} color={Colors.white} />
            </View>
            <Text style={styles.title}>Connexion impossible</Text>
            <Text style={styles.subtitle}>{errorMsg}</Text>
            <TouchableOpacity style={styles.btn} onPress={() => router.replace('/login')} activeOpacity={0.85}>
              <Text style={styles.btnText}>Retour à la connexion</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: Colors.card, borderRadius: 28, padding: 32, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, maxWidth: 420, width: '100%',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08, shadowRadius: 28, elevation: 6,
  },
  iconBox: {
    width: 72, height: 72, borderRadius: 22, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.foreground, marginTop: 20, textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.mutedForeground, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  btn: {
    marginTop: 24, height: 48, borderRadius: 24, paddingHorizontal: 24,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  btnText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
});
