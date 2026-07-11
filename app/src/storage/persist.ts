/**
 * Gemeinsame Persistenz-Bausteine für die zustand-Stores.
 * AsyncStorage als Backend (strukturiertes JSON, offline, keine native Konfig).
 *
 * Hinweis: expo-secure-store wäre für kleine Geheimnisse gedacht (hier nicht nötig),
 * react-native-mmkv wäre schneller, bräuchte aber native Konfig – erst bei Bedarf.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

export const zustandStorage = createJSONStorage(() => AsyncStorage);
