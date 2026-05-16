import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import api, { AI_TIMEOUT_MS } from '../services/api';

interface Tip { title: string; content: string; }
interface CoachResponse { summary?: string; tips: Tip[]; source?: string; }

const TIP_ICONS = ['nutrition', 'water', 'leaf', 'flame', 'fitness', 'restaurant'] as const;

export default function AICoachScreen() {
  const router = useRouter();
  const [tips, setTips] = useState<CoachResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [error, setError] = useState('');

  const fetchTips = async (q?: string) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(
        '/products/coach-tips',
        { question: q || undefined },
        { timeout: AI_TIMEOUT_MS }
      );
      setTips(data);
    } catch (e: any) {
      const isTimeout = e?.code === 'ECONNABORTED' || /timeout/i.test(e?.message || '');
      setError(
        isTimeout
          ? "Le coach IA met trop de temps à répondre. Vérifiez qu'Ollama tourne ou réessayez."
          : "Impossible de contacter le coach IA. Vérifiez votre connexion."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTips(); }, []);

  const handleAsk = () => {
    const q = question.trim();
    if (!q) return;
    fetchTips(q);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Coach IA</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroBlob} />
            <View style={styles.heroIcon}>
              <Ionicons name="sparkles" size={28} color={Colors.white} />
            </View>
            <Text style={styles.heroTitle}>Mangez mieux avec l'IA</Text>
            <Text style={styles.heroSub}>
              Des conseils personnalisés basés sur votre historique et vos objectifs nutritionnels.
            </Text>
          </View>

          {/* Ask the coach */}
          <View style={styles.askCard}>
            <Text style={styles.askLabel}>Une question précise ?</Text>
            <View style={styles.askRow}>
              <TextInput
                style={styles.askInput}
                placeholder="Ex: comment réduire mon sucre ?"
                placeholderTextColor={Colors.mutedForeground}
                value={question}
                onChangeText={setQuestion}
                returnKeyType="send"
                onSubmitEditing={handleAsk}
              />
              <TouchableOpacity
                style={[styles.askBtn, !question.trim() && { opacity: 0.5 }]}
                onPress={handleAsk}
                disabled={!question.trim() || loading}
                activeOpacity={0.8}
              >
                <Ionicons name="send" size={18} color={Colors.white} />
              </TouchableOpacity>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Tips */}
          {loading && !tips ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Le coach analyse vos habitudes…</Text>
              <Text style={styles.loadingHint}>Cela peut prendre 30 à 60 secondes avec Ollama local</Text>
            </View>
          ) : tips ? (
            <View style={{ gap: 14 }}>
              {tips.summary ? (
                <View style={styles.summaryCard}>
                  <Ionicons name="bulb" size={20} color={Colors.accent} />
                  <Text style={styles.summaryText}>{tips.summary}</Text>
                </View>
              ) : null}

              {tips.tips.map((tip, i) => (
                <View key={i} style={styles.tipCard}>
                  <View style={[styles.tipIconBox, { backgroundColor: i % 2 === 0 ? Colors.primary : Colors.accent }]}>
                    <Ionicons
                      name={TIP_ICONS[i % TIP_ICONS.length] as any}
                      size={20}
                      color={Colors.white}
                    />
                  </View>
                  <View style={styles.tipBody}>
                    <Text style={styles.tipTitle}>{tip.title}</Text>
                    <Text style={styles.tipContent}>{tip.content}</Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={styles.regenBtn}
                onPress={() => { setQuestion(''); fetchTips(); }}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons name="refresh" size={18} color={Colors.primary} />
                    <Text style={styles.regenText}>Régénérer les conseils</Text>
                  </>
                )}
              </TouchableOpacity>

              {tips.source ? (
                <Text style={styles.sourceText}>Source : {tips.source}</Text>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.muted, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.foreground },
  scroll: { padding: 20, paddingBottom: 40 },

  hero: {
    backgroundColor: Colors.primary, borderRadius: 28, padding: 24, marginBottom: 18,
    position: 'relative', overflow: 'hidden',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25, shadowRadius: 24, elevation: 6,
  },
  heroBlob: {
    position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: 90,
    backgroundColor: Colors.accent, opacity: 0.18,
  },
  heroIcon: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: { fontSize: 24, fontWeight: '700', color: Colors.white, marginBottom: 6 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },

  askCard: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 18,
  },
  askLabel: { fontSize: 14, fontWeight: '600', color: Colors.foreground, marginBottom: 10 },
  askRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  askInput: {
    flex: 1, height: 46, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.muted, paddingHorizontal: 14, fontSize: 14, color: Colors.foreground,
  },
  askBtn: { width: 46, height: 46, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },

  loadingBox: { alignItems: 'center', padding: 40 },
  loadingText: { fontSize: 14, color: Colors.mutedForeground, marginTop: 14 },
  loadingHint: { fontSize: 12, color: Colors.mutedForeground, marginTop: 6, fontStyle: 'italic' },

  summaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: `${Colors.accent}18`, borderRadius: 16, padding: 16,
  },
  summaryText: { fontSize: 14, color: Colors.foreground, flex: 1, lineHeight: 20 },

  tipCard: {
    flexDirection: 'row', gap: 14,
    backgroundColor: Colors.card, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  tipIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tipBody: { flex: 1 },
  tipTitle: { fontSize: 15, fontWeight: '700', color: Colors.foreground, marginBottom: 4 },
  tipContent: { fontSize: 13, color: Colors.mutedForeground, lineHeight: 19 },

  regenBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: Colors.primary, marginTop: 6,
  },
  regenText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  sourceText: { fontSize: 11, color: Colors.mutedForeground, textAlign: 'center', marginTop: 4 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEE2E2', borderRadius: 12, padding: 14, marginBottom: 14,
  },
  errorText: { color: '#DC2626', fontSize: 13, flex: 1 },
});
