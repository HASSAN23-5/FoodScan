import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import NutriScore from './NutriScore';
import NovaGroup from './NovaGroup';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  code: string;
  product_name: string;
  brands?: string;
  image_url?: string;
  nutriscore_grade?: string;
  nova_group?: number | null;
}

export default function ProductCard({ code, product_name, brands, image_url, nutriscore_grade, nova_group }: Props) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/product/${code}`)}
    >
      <View style={styles.imageContainer}>
        {image_url ? (
          <Image source={{ uri: image_url }} style={styles.image} resizeMode="contain" />
        ) : (
          <Ionicons name="leaf" size={32} color={Colors.mutedForeground} />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{product_name || 'Produit inconnu'}</Text>
        <Text style={styles.brand} numberOfLines={1}>{brands || 'Marque inconnue'}</Text>
        <View style={styles.badges}>
          {nutriscore_grade ? <NutriScore grade={nutriscore_grade} size="small" /> : null}
          {nova_group ? <NovaGroup group={nova_group} size="small" /> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  imageContainer: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  info: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '600', color: Colors.foreground, marginBottom: 2 },
  brand: { fontSize: 13, color: Colors.mutedForeground, marginBottom: 6 },
  badges: { flexDirection: 'row', gap: 8 },
});
