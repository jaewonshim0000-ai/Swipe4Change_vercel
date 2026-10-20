import { useState } from 'react';
import { Text, View } from 'react-native';
import type { UseFormReturn } from 'react-hook-form';
import type { Draft } from '../domain/model';
import { useDraftWriter } from '../data/civic-lookup';
import { Glyph } from './glyph';
import { gradient, gradients, shadows } from './theme';
import { Button, Field, Notice, colors, fonts, styles } from './ui';

const drafted = ['title', 'summary', 'problem', 'action', 'topic'] as const;
type Drafted = Pick<Draft, (typeof drafted)[number]>;

/**
 * "Draft it with AI": the creator describes the problem in their own words (any language, or the
 * keyboard's dictation) and the AI drafts the petition's wording. Every field stays editable,
 * one tap undoes it, and nothing is published without the creator reviewing each step.
 */
export function DraftWriter({ form }: { form: UseFormReturn<Draft> }) {
  const writer = useDraftWriter();
  const [description, setDescription] = useState('');
  const [before, setBefore] = useState<Drafted | null>(null);
  const ready = description.trim().length >= 15;
  function write() {
    writer.mutate(
      { description: description.trim(), city: form.getValues('city') },
      {
        onSuccess: (d) => {
          const values = form.getValues();
          setBefore(Object.fromEntries(drafted.map((k) => [k, values[k]])) as Drafted);
          for (const k of drafted) form.setValue(k, d[k], { shouldValidate: true });
        },
      },
    );
  }
  function undo() {
    if (!before) return;
    for (const k of drafted) form.setValue(k, before[k], { shouldValidate: true });
    setBefore(null);
    writer.reset();
  }
  return (
    // The design's AI card: a pale-to-olive gradient border around a white card.
    <View
      style={[
        { borderRadius: 20, padding: 1.5, marginBottom: 14, backgroundColor: colors.sage },
        gradient(gradients.ai),
        shadows.card,
      ]}
    >
      <View style={{ backgroundColor: colors.white, borderRadius: 18, padding: 20, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Glyph name="sparkle" size={24} weight={2} color={colors.accent} />
          <Text
            accessibilityRole="header"
            style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: colors.ink }}
          >
            Draft it with AI
          </Text>
        </View>
        <Text style={[styles.small, { fontSize: 14, lineHeight: 21 }]}>
          Tell us what’s wrong and what you want changed, in your own words or language. You can use
          your keyboard’s microphone.
        </Text>
        <Field
          label="What’s wrong, and what should change?"
          multiline
          value={description}
          onChangeText={setDescription}
          maxLength={3000}
          placeholder="There’s no light on the path from the bus stop to school and we walk it in the dark after practice…"
        />
        <Button
          title={writer.isPending ? 'Writing your petition…' : 'Draft my petition'}
          icon="sparkles-outline"
          disabled={!ready || writer.isPending}
          onPress={write}
        />
        {writer.error && <Notice error text={writer.error.message} />}
        {writer.data && before && (
          <View style={{ gap: 6 }}>
            <Notice text="Drafted below. Read each field and change anything that isn’t quite right." />
            {writer.data.questions.length > 0 && (
              <View style={{ gap: 2 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary }}>
                  Make it stronger by adding:
                </Text>
                {writer.data.questions.map((q) => (
                  <Text key={q} style={[styles.muted, { fontSize: 13 }]}>
                    • {q}
                  </Text>
                ))}
              </View>
            )}
            <Button title="Undo AI draft" variant="ghost" onPress={undo} />
          </View>
        )}
        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            alignItems: 'flex-start',
            padding: 14,
            borderRadius: 16,
            backgroundColor: colors.quiet,
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          <Glyph name="sparkle" size={18} weight={2} color={colors.accent} />
          <Text style={[styles.small, { flex: 1, color: colors.secondary }]}>
            AI drafts only from your words. It won’t invent facts, numbers, names or officials, and
            it never picks the recipient for you.
          </Text>
        </View>
      </View>
    </View>
  );
}
