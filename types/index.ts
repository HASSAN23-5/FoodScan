export interface User {
  user_id: string;
  email: string;
  name: string;
  role: string;
  picture?: string;
}

export interface Product {
  code: string;
  product_name: string;
  brands: string;
  image_url: string;
  image_front_url?: string;
  image_small_url: string;
  nutriscore_grade: string;
  nova_group: number | null;
  categories: string;
  ingredients_text?: string;
  allergens?: string;
  quantity?: string;
  nutriments?: Nutriments;
}

export interface Nutriments {
  energy_kcal_100g: number | null;
  fat_100g: number | null;
  saturated_fat_100g: number | null;
  carbohydrates_100g: number | null;
  sugars_100g: number | null;
  fiber_100g: number | null;
  proteins_100g: number | null;
  salt_100g: number | null;
  sodium_100g: number | null;
}

export interface ScanHistoryItem {
  scan_id: string;
  user_id: string;
  barcode: string;
  product_name: string;
  nutriscore_grade: string;
  nova_group: number | null;
  image_url: string;
  scanned_at: string;
}

export interface Alternative {
  name: string;
  reason: string;
  benefits: string[];
}

export interface AlternativesResponse {
  alternatives: Alternative[];
  general_advice: string;
}
