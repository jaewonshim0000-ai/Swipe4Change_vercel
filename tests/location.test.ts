import {
  cityFromReverse,
  cityFromSearch,
  normalizeCity,
  sameCity,
  sampleCities,
} from '../src/domain/location';

test('cities match regardless of case, spacing, punctuation or a spelled-out state', () => {
  expect(sameCity('Irvine, CA', 'irvine,ca')).toBe(true);
  expect(sameCity('Irvine, California', 'Irvine CA')).toBe(true);
  expect(sameCity(' New York,  New York ', 'New York, NY')).toBe(true);
  expect(sameCity('Washington, District of Columbia', 'washington dc')).toBe(true);
  expect(sameCity('Irvine, CA', 'Irvine, WY')).toBe(false);
  expect(sameCity('Irvine, CA', 'Costa Mesa, CA')).toBe(false);
  expect(sameCity('Irvine, CA', undefined)).toBe(false);
  expect(sameCity('', '')).toBe(false);
  expect(normalizeCity(' St. Louis , Missouri ')).toBe('st louis mo');
});

test('a city search result becomes a "City, ST" place with its county', () => {
  expect(
    cityFromSearch({
      name: 'Spring',
      country_code: 'US',
      admin1: 'Texas',
      admin2: 'Harris County',
    }),
  ).toEqual({ city: 'Spring, TX', detail: 'Harris County · Texas' });
  expect(cityFromSearch({ name: 'Paris', country_code: 'FR', admin1: 'Île-de-France' })).toBeNull();
  expect(cityFromSearch({ name: 'Nowhere', country_code: 'US', admin1: 'Atlantis' })).toBeNull();
});

test('a reverse lookup keeps only the city and state', () => {
  expect(
    cityFromReverse({
      address: { city: 'Seattle', county: 'King County', 'ISO3166-2-lvl4': 'US-WA' },
    }),
  ).toBe('Seattle, WA');
  expect(cityFromReverse({ address: { town: 'Spring', 'ISO3166-2-lvl4': 'US-TX' } })).toBe(
    'Spring, TX',
  );
  expect(cityFromReverse({ address: { city: 'Lyon', 'ISO3166-2-lvl4': 'FR-ARA' } })).toBeNull();
  expect(cityFromReverse({})).toBeNull();
});

test('sample cities are the fictional demo towns', () => {
  expect(sampleCities.map((c) => c.city)).toEqual(['Irvine, CA', 'Costa Mesa, CA']);
});
