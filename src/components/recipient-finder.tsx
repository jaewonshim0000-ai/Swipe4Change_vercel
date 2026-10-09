import { Linking, Pressable, Text, View } from 'react-native';
import { officialTitle } from '../../supabase/functions/_shared/officials';
import type { RecipientSuggestion } from '../../supabase/functions/_shared/civic-ai';
import { isSampleCity, useOfficials, useRecipientFinder } from '../data/civic-lookup';
import { PillChip } from './kit';
import { Button, Notice, colors, fonts, styles } from './ui';

const small = { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.muted };

/**
 * Under "Who can make this change?": the real elected officials for the petition's city, and the
 * AI recipient finder. Both only suggest; the creator decides what goes in the recipient field.
 */
export function RecipientHelp({
  draft,
  onPick,
}: {
  draft: { title: string; problem: string; action: string; city: string; recipient: string };
  onPick: (recipient: string) => void;
}) {
  const officials = useOfficials(draft.city);
  const finder = useRecipientFinder();
  const sample = isSampleCity(draft.city);
  const ready = `${draft.problem}${draft.action}`.trim().length >= 10;
  return (
    <View style={{ gap: 10 }}>
      {!sample && !!draft.city && (
        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.secondary }}>
            Your elected officials in {draft.city.split(',')[0]}
          </Text>
          {officials.isPending && <Text style={small}>Looking up your representatives…</Text>}
          {officials.error && <Text style={small}>{officials.error.message}</Text>}
          {officials.data && (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {officials.data.officials.map((o) => (
                  <PillChip
                    key={`${o.office}-${o.name}`}
                    label={`${o.name} · ${o.office}`}
                    height={32}
                    selected={draft.recipient === officialTitle(o)}
                    onPress={() => onPick(officialTitle(o))}
                  />
                ))}
              </View>
              <Text style={[styles.micro, { fontSize: 11.5 }]}>
                Districts are for the centre of {draft.city.split(',')[0]}; a large city can have
                several. {officials.data.stateNote ?? ''}
              </Text>
            </>
          )}
        </View>
      )}
      <Button
        title={finder.isPending ? 'Searching public sources…' : 'Find the right recipient ✦'}
        variant="secondary"
        disabled={finder.isPending || !ready || !draft.city}
        onPress={() =>
          finder.mutate({
            title: draft.title,
            problem: draft.problem,
            action: draft.action,
            city: draft.city,
          })
        }
      />
      {!ready && (
        <Text style={small}>
          Describe the change you want first, then the AI can search for who decides it.
        </Text>
      )}
      {finder.error && <Notice error text={finder.error.message} />}
      {finder.data && (
        <Suggestion
          suggestion={finder.data}
          onUse={() => {
            onPick(finder.data.recipient);
            finder.reset();
          }}
          onDismiss={() => finder.reset()}
        />
      )}
    </View>
  );
}

function Suggestion({
  suggestion: s,
  onUse,
  onDismiss,
}: {
  suggestion: RecipientSuggestion;
  onUse: () => void;
  onDismiss: () => void;
}) {
  const contact = [s.contact.email, s.contact.phone, s.contact.url].filter(Boolean);
  return (
    <View
      accessibilityLabel="AI recipient suggestion"
      style={{ backgroundColor: colors.soft, borderRadius: 18, padding: 14, gap: 8 }}
    >
      <Text
        style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, color: colors.accent }}
      >
        AI SUGGESTION · CHECK BEFORE SENDING
      </Text>
      <Text style={{ fontFamily: fonts.heading, fontSize: 17, lineHeight: 22, color: colors.ink }}>
        {s.recipient}
      </Text>
      <Text style={[small, { color: colors.secondary }]}>{s.reason}</Text>
      {contact.length > 0 && <Text style={small}>Contact: {contact.join(' · ')}</Text>}
      {s.sources.length > 0 && (
        <View style={{ gap: 2 }}>
          <Text style={[small, { fontFamily: fonts.semibold }]}>Sources</Text>
          {s.sources.map((source) => (
            <Pressable
              key={source.url}
              accessibilityRole="link"
              onPress={() => void Linking.openURL(source.url)}
            >
              <Text numberOfLines={1} style={[small, { color: colors.accent }]}>
                {source.title || source.url}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <Button title="Use this" onPress={onUse} style={{ flex: 1 }} />
        <Button title="Dismiss" variant="ghost" onPress={onDismiss} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
