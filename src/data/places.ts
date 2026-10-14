import { Platform } from 'react-native';
import * as Location from 'expo-location';
import {
  Place,
  SearchResult,
  cityFromReverse,
  cityFromSearch,
  normalizeCity,
  sameCity,
  sampleCities,
} from '../domain/location';
import { isDemo } from './provider';

/** Type-ahead search of real US cities through Open-Meteo's free geocoder (no key needed). */
export async function searchCities(query: string, signal?: AbortSignal): Promise<Place[]> {
  const name = query.split(',')[0].trim();
  if (name.length < 2) return [];
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?count=10&countryCode=US&language=en&name=${encodeURIComponent(name)}`,
    { signal },
  );
  if (!response.ok) throw new Error('City search is unavailable right now. Try again.');
  const { results = [] } = (await response.json()) as { results?: SearchResult[] };
  const places = results
    .map(cityFromSearch)
    .filter((p, i, all): p is Place => !!p && all.findIndex((q) => q?.city === p.city) === i);
  // The geocoder is fuzzy; prefer the cities that start with what was typed.
  const typed = normalizeCity(query);
  const prefix = places.filter((p) => normalizeCity(p.city).startsWith(typed));
  return (prefix.length ? prefix : places).slice(0, 6);
}

/**
 * Reads the device position once, rounds it to about a kilometre, and asks OpenStreetMap which
 * city that is. Only the "City, ST" answer is returned; the coordinates are never stored.
 */
export async function cityFromDevice(): Promise<string> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) throw new Error('Location access was declined. Search for your city instead.');
  const { coords } = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Low,
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=${coords.latitude.toFixed(2)}&lon=${coords.longitude.toFixed(2)}`,
    // Nominatim asks apps to identify themselves; browsers send their own User-Agent.
    {
      headers: {
        'Accept-Language': 'en',
        ...(Platform.OS === 'web' ? {} : { 'User-Agent': 'Swipe4Change civic petition app' }),
      },
    },
  );
  if (!response.ok) throw new Error('We couldn’t look up your city. Search for it instead.');
  const city = cityFromReverse(await response.json());
  if (!city)
    throw new Error('We couldn’t find a US city for your location. Search for it instead.');
  return city;
}

/** The centre of a chosen city, for district lookups. Null for the fictional sample cities. */
export async function cityCentre(city: string): Promise<{ lat: number; lon: number } | null> {
  if (isDemo && sampleCities.some((c) => sameCity(c.city, city))) return null;
  const match = (await searchCities(city)).find((p) => sameCity(p.city, city));
  return match?.lat !== undefined && match.lon !== undefined
    ? { lat: match.lat, lon: match.lon }
    : null;
}
