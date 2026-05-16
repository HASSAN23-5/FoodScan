import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import api, { AI_TIMEOUT_MS } from '../../services/api';
import NutriScore from '../../components/NutriScore';
import NovaGroup from '../../components/NovaGroup';
import { Product, AlternativesResponse } from '../../types';

const NUTRI_LABELS: Record<string, string> = {
  A: 'Très bonne qualité nutritionnelle',
  B: 'Bonne qualité nutritionnelle',
  C: 'Qualité nutritionnelle moyenne',
  D: 'Qualité nutritionnelle faible',
  E: 'Qualité nutritionnelle très faible',
};

const NOVA_LABELS: Record<number, string> = {
  1: 'Aliments non transformés',
  2: 'Ingrédients culinaires',
  3: 'Aliments transformés',
  4: 'Produits ultra-transformés',
};

export default function ProductScreen() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [alternatives, setAlternatives] = useState<AlternativesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [altLoading, setAltLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchProduct();
  }, [barcode]);

  const fetchProduct = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/products/barcode/${barcode}`);
      setProduct(data);
      // Save scan history
      try {
        await api.post('/scan/save', {
          barcode: data.code,
          product_name: data.product_name,
          nutriscore_grade: data.nutriscore_grade,
          nova_group: data.nova_group,
          image_url: data.image_small_url || data.image_url,
        });
      } catch {}
    } catch (e: any) {
      setError(e.response?.status === 404 ? 'Produit non trouvé' : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const fetchAlternatives = async () => {
    if (!product || altLoading) return;
    setAltLoading(true);
    try {
      const { data } = await api.post('/products/alternatives', {
        product_name: product.product_name,
        nutri_score: product.nutriscore_grade || 'unknown',
        nova_group: product.nova_group || 4,
        calories: product.nutriments?.energy_kcal_100g,
        sugars: product.nutriments?.sugars_100g,
        fat: product.nutriments?.fat_100g,
        salt: product.nutriments?.salt_100g,
      }, { timeout: AI_TIMEOUT_MS });
      setAlternatives(data);
    } catch (e: any) {
      console.error('Alternatives error:', e);
      // Friendlier message visible to the user
      const isTimeout = e?.code === 'ECONNABORTED' || /timeout/i.test(e?.message || '');
      setAlternatives({
        alternatives: [],
        general_advice: isTimeout
          ? "Le service IA met trop de temps à répondre. Vérifiez qu'Ollama tourne ou réessayez."
          : "Impossible de générer les alternatives pour le moment. Réessayez.",
      } as any);
    } finally {
      setAltLoading(false);
    }
  };

  const fmt = (val: number | null | undefined, dec = 1) =>
    val != null ? val.toFixed(dec) : '-';

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.destructive} />
        <Text style={styles.errorTitle}>{error}</Text>
        <Text style={styles.errorSub}>Le code-barres {barcode} n'a pas été trouvé.</Text>
        <View style={styles.errorActions}>
          <TouchableOpacity style={styles.errorBtn} onPress={() => router.back()}>
            <Text style={styles.errorBtnText}>Retour</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.errorBtn, styles.errorBtnPrimary]} onPress={() => router.push('/(tabs)/scan')}>
            <Text style={[styles.errorBtnText, { color: Colors.white }]}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!product) return null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Détails du produit</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Product Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroImage}>
            {product.image_url || product.image_front_url ? (
              <Image source={{ uri: product.image_front_url || product.image_url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            ) : (
              <Ionicons name="leaf" size={48} color={Colors.mutedForeground} />
            )}
          </View>
          <Text style={styles.productName}>{product.product_name || 'Produit inconnu'}</Text>
          <Text style={styles.productBrand}>{product.brands || 'Marque inconnue'}{product.quantity ? ` - ${product.quantity}` : ''}</Text>

          {/* Scores */}
          <View style={styles.scoresRow}>
            <View style={styles.scoreItem}>
              <NutriScore grade={product.nutriscore_grade} size="large" />
              <Text style={styles.scoreLabel}>NUTRI-SCORE</Text>
              <Text style={styles.scoreDesc}>{NUTRI_LABELS[product.nutriscore_grade?.toUpperCase()] || 'Non défini'}</Text>
            </View>
            <View style={styles.scoreItem}>
              <NovaGroup group={product.nova_group} size="large" />
              <Text style={styles.scoreLabel}>NOVA</Text>
              <Text style={styles.scoreDesc}>{NOVA_LABELS[product.nova_group || 0] || 'Non défini'}</Text>
            </View>
          </View>
        </View>

        {/* Nutrition Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations nutritionnelles</Text>
          <Text style={styles.sectionSub}>Pour 100g</Text>
          <View style={styles.nutriGrid}>
            <View style={styles.nutriCell}>
              <Ionicons name="flame-outline" size={22} color={Colors.accent} />
              <Text style={styles.nutriValue}>{fmt(product.nutriments?.energy_kcal_100g, 0)}</Text>
              <Text style={styles.nutriLabel}>kcal</Text>
            </View>
            <View style={styles.nutriCell}>
              <Ionicons name="water-outline" size={22} color={Colors.primary} />
              <Text style={styles.nutriValue}>{fmt(product.nutriments?.fat_100g)}</Text>
              <Text style={styles.nutriLabel}>graisses (g)</Text>
            </View>
            <View style={styles.nutriCell}>
              <Ionicons name="cafe-outline" size={22} color={Colors.accent} />
              <Text style={styles.nutriValue}>{fmt(product.nutriments?.sugars_100g)}</Text>
              <Text style={styles.nutriLabel}>sucres (g)</Text>
            </View>
            <View style={styles.nutriCell}>
              <Ionicons name="barbell-outline" size={22} color={Colors.primary} />
              <Text style={styles.nutriValue}>{fmt(product.nutriments?.proteins_100g)}</Text>
              <Text style={styles.nutriLabel}>protéines (g)</Text>
            </View>
          </View>

          {/* Expandable details */}
          <TouchableOpacity style={styles.detailToggle} onPress={() => setShowDetails(!showDetails)}>
            <Text style={styles.detailToggleText}>Voir tous les détails</Text>
            <Ionicons name={showDetails ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.foreground} />
          </TouchableOpacity>

          {showDetails && (
            <View style={styles.detailsList}>
              {[
                ['Énergie', `${fmt(product.nutriments?.energy_kcal_100g, 0)} kcal`],
                ['Graisses', `${fmt(product.nutriments?.fat_100g)} g`],
                ['dont saturées', `${fmt(product.nutriments?.saturated_fat_100g)} g`],
                ['Glucides', `${fmt(product.nutriments?.carbohydrates_100g)} g`],
                ['dont sucres', `${fmt(product.nutriments?.sugars_100g)} g`],
                ['Fibres', `${fmt(product.nutriments?.fiber_100g)} g`],
                ['Protéines', `${fmt(product.nutriments?.proteins_100g)} g`],
                ['Sel', `${fmt(product.nutriments?.salt_100g, 2)} g`],
              ].map(([label, value], i) => (
                <View key={i} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Ingredients */}
        {product.ingredients_text ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingrédients</Text>
            <Text style={styles.ingredientsText}>{product.ingredients_text}</Text>
            {product.allergens ? (
              <View style={styles.allergensWrap}>
                <Text style={styles.allergensLabel}>ALLERGÈNES</Text>
                <View style={styles.allergensRow}>
                  {product.allergens.split(',').map((a, i) => (
                    <View key={i} style={styles.allergenBadge}>
                      <Text style={styles.allergenText}>{a.trim().replace('en:', '')}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* AI Alternatives */}
        <View style={styles.altSection}>
          <View style={styles.altHeader}>
            <Ionicons name="sparkles" size={20} color={Colors.accent} />
            <Text style={styles.altTitle}>Alternatives plus saines</Text>
          </View>
          <Text style={styles.altSub}>Recommandations basées sur l'IA</Text>

          {!alternatives ? (
            <TouchableOpacity
              style={styles.altBtn}
              onPress={fetchAlternatives}
              disabled={altLoading}
              activeOpacity={0.8}
            >
              {altLoading ? (
                <>
                  <ActivityIndicator color={Colors.white} />
                  <Text style={[styles.altBtnText, { marginLeft: 10 }]}>L'IA réfléchit…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color={Colors.white} />
                  <Text style={styles.altBtnText}>Trouver des alternatives</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ gap: 12, marginTop: 12 }}>
              {alternatives.alternatives?.map((alt, i) => (
                <View key={i} style={styles.altCard}>
                  <Text style={styles.altCardName}>{alt.name}</Text>
                  <Text style={styles.altCardReason}>{alt.reason}</Text>
                  <View style={styles.altBenefits}>
                    {alt.benefits?.map((b, j) => (
                      <View key={j} style={styles.benefitBadge}>
                        <Text style={styles.benefitText}>{b}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
              {alternatives.general_advice ? (
                <View style={styles.adviceCard}>
                  <Text style={styles.adviceText}>
                    <Text style={{ fontWeight: '700' }}>Conseil : </Text>
                    {alternatives.general_advice}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerScreen: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.muted, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: Colors.foreground, flex: 1, textAlign: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },
  heroCard: {
    backgroundColor: Colors.card, borderRadius: 24, padding: 20, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, marginBottom: 16,
  },
  heroImage: {
    width: 140, height: 140, borderRadius: 16, backgroundColor: Colors.muted,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden',
  },
  productName: { fontSize: 22, fontWeight: '700', color: Colors.foreground, textAlign: 'center', marginBottom: 4 },
  productBrand: { fontSize: 14, color: Colors.mutedForeground, marginBottom: 20 },
  scoresRow: { flexDirection: 'row', gap: 32 },
  scoreItem: { alignItems: 'center', gap: 6 },
  scoreLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: Colors.mutedForeground },
  scoreDesc: { fontSize: 12, color: Colors.foreground, textAlign: 'center', maxWidth: 120 },
  section: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.foreground, marginBottom: 2 },
  sectionSub: { fontSize: 13, color: Colors.mutedForeground, marginBottom: 16 },
  nutriGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  nutriCell: {
    flex: 1, minWidth: '45%', backgroundColor: Colors.muted, borderRadius: 16, padding: 14, alignItems: 'center',
  },
  nutriValue: { fontSize: 24, fontWeight: '700', color: Colors.foreground, marginTop: 4 },
  nutriLabel: { fontSize: 11, color: Colors.mutedForeground, marginTop: 2 },
  detailToggle: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 16, marginTop: 16, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  detailToggleText: { fontSize: 15, fontWeight: '500', color: Colors.foreground },
  detailsList: { marginTop: 12 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  detailLabel: { fontSize: 14, color: Colors.mutedForeground },
  detailValue: { fontSize: 14, fontWeight: '500', color: Colors.foreground },
  ingredientsText: { fontSize: 14, color: Colors.mutedForeground, lineHeight: 20 },
  allergensWrap: { marginTop: 16 },
  allergensLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: Colors.mutedForeground, marginBottom: 8 },
  allergensRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  allergenBadge: { backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  allergenText: { fontSize: 12, color: '#DC2626', fontWeight: '500' },
  altSection: {
    backgroundColor: Colors.secondary, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: Colors.border,
  },
  altHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  altTitle: { fontSize: 18, fontWeight: '600', color: Colors.foreground },
  altSub: { fontSize: 13, color: Colors.mutedForeground, marginBottom: 16 },
  altBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: 25, backgroundColor: Colors.primary,
  },
  altBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  altCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  altCardName: { fontSize: 15, fontWeight: '600', color: Colors.foreground, marginBottom: 4 },
  altCardReason: { fontSize: 13, color: Colors.mutedForeground, marginBottom: 8 },
  altBenefits: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  benefitBadge: { backgroundColor: `${Colors.primary}18`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  benefitText: { fontSize: 12, color: Colors.primary, fontWeight: '500' },
  adviceCard: { backgroundColor: `${Colors.primary}18`, borderRadius: 16, padding: 14 },
  adviceText: { fontSize: 13, color: Colors.foreground, lineHeight: 18 },
  errorTitle: { fontSize: 22, fontWeight: '700', color: Colors.foreground, marginTop: 16, marginBottom: 6 },
  errorSub: { fontSize: 14, color: Colors.mutedForeground, textAlign: 'center', marginBottom: 24 },
  errorActions: { flexDirection: 'row', gap: 12 },
  errorBtn: {
    borderRadius: 20, paddingHorizontal: 24, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  errorBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  errorBtnText: { fontSize: 15, fontWeight: '600', color: Colors.foreground },
});
