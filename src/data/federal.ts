import { useQuery } from '@tanstack/react-query';
import { federalSearchUrl, toFederalRules } from '../domain/federal';

/** Proposed federal rules still open for comment, straight from the Federal Register. */
export function useFederalRules() {
  return useQuery({
    queryKey: ['federal'],
    staleTime: 3_600_000,
    retry: 1,
    queryFn: async () => {
      // The viewer's local date, so a rule closing today still shows in the evening.
      const d = new Date();
      const today = [d.getFullYear(), d.getMonth() + 1, d.getDate()]
        .map((n) => String(n).padStart(2, '0'))
        .join('-');
      const response = await fetch(federalSearchUrl(today));
      if (!response.ok) throw new Error(`The Federal Register answered ${response.status}.`);
      return toFederalRules(await response.json());
    },
  });
}
