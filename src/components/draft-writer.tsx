import { useState } from 'react';
import { Text, View } from 'react-native';
import type { UseFormReturn } from 'react-hook-form';
import type { Draft } from '../domain/model';
import { useDraftWriter } from '../data/civic-lookup';
import { Button, Field, Notice, colors, fonts, styles } from './ui';

const drafted = ['title', 'summary', 'problem', 'action', 'topic'] as const;
type Drafted = Pick<Draft, (typeof drafted)[number]>;

/**
 * "Write it for me": the creator describes the problem in their own words (any language, or the
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
    <View
      style={{
        backgroundColor: colors.soft,
        borderRadius: 24,
        padding: 16,
        gap: 10,
        marginBottom: 14,
      }}
    >
      <Text style={[styles.label, { fontSize: 10.5, letterSpacing: 1.2 }]}>
        Write it for me ✦ AI
      </Text>
      <Text
        style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.secondary }}
      >
        Tell us what’s wrong and what you want changed, in your own words or language. You can use
        your keyboard’s microphone. The AI drafts the petition; you check every word.
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
        title={writer.isPending ? 'Writing your petition…' : 'Draft my petition ✦'}
        disabled={!ready || writer.isPending}
        onPress={write}
      />
      {writer.error && <Notice error text={writer.error.message} />}
      {writer.data && before && (
        <View style={{ gap: 6 }}>
          <Notice text="Drafted below. Read each field and change anything that isn’t quite right." />
          {writer.data.questions.length > 0 && (
            <View style={{ gap: 2 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.secondary }}>
                Make it stronger by adding:
              </Text>
              {writer.data.questions.map((q) => (
                <Text key={q} style={[styles.muted, { fontSize: 12.5 }]}>
                  • {q}
                </Text>
              ))}
            </View>
          )}
          <Button title="Undo AI draft" variant="ghost" onPress={undo} />
        </View>
      )}
    </View>
  );
}
