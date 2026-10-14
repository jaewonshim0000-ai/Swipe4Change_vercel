import { useMutation, useQuery } from '@tanstack/react-query';
import type { OfficialsResult } from '../../supabase/functions/_shared/officials';
import type { RecipientQuestion } from '../../supabase/functions/_shared/civic-ai';
import { normalizeCity, sameCity, sampleCities } from '../domain/location';
import { cityCentre } from './places';
import { isDemo, useBackend } from './provider';

/** The demo's fictional towns. The real app treats those names like any other place. */
export const isSampleCity = (city: string) =>
  isDemo && sampleCities.some((c) => sameCity(c.city, city));

/** Elected officials for a city: two U.S. senators, the House member, and state legislators. */
export function useOfficials(city: string | undefined) {
  const { adapter } = useBackend();
  return useQuery({
    queryKey: ['officials', normalizeCity(city ?? '')],
    enabled: !!city && !isSampleCity(city),
    staleTime: 86400000,
    retry: false,
    queryFn: async () => {
      const centre = await cityCentre(city!);
      if (!centre) throw new Error(`We couldn’t place ${city} on the map.`);
      return (await adapter.lookup({ task: 'officials', ...centre })) as OfficialsResult;
    },
  });
}

/** The AI recipient finder. Sends only the draft's title, problem, action and city. */
export function useRecipientFinder() {
  const { adapter } = useBackend();
  return useMutation({
    mutationFn: async (question: RecipientQuestion) => {
      const centre = await cityCentre(question.city).catch(() => null);
      const result = await adapter.lookup({ task: 'recipient', question, ...(centre ?? {}) });
      if (!('suggestion' in result)) throw new Error('The recipient finder gave no answer.');
      if (!result.suggestion)
        throw new Error('No recipient could be confirmed from public sources. Try adding detail.');
      return result.suggestion;
    },
  });
}

/** The AI petition writer. Sends only the description and the chosen city. */
export function useDraftWriter() {
  const { adapter } = useBackend();
  return useMutation({
    mutationFn: async ({ description, city }: { description: string; city: string }) => {
      const result = await adapter.lookup({ task: 'draft', description, city });
      if (!('draft' in result)) throw new Error('The writer gave no answer.');
      if (!result.draft)
        throw new Error(
          'That doesn’t read like a request for change yet. Describe the problem and what you want done.',
        );
      return result.draft;
    },
  });
}
