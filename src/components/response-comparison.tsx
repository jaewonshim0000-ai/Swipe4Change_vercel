import { useState } from 'react';
import { Text, View } from 'react-native';
import { useCommand } from '../data/provider';
import { Petition, ResponseCheck } from '../domain/model';
import {
  responseCheckStatusLabels,
  responseChecksFor,
  responseChecksSchema,
} from '../domain/response-checks';
import { Button, Chip, Field, Notice, Panel, styles } from './ui';

const assessedStatuses: ResponseCheck['status'][] = ['answered', 'partial', 'unanswered'];

export function ResponseComparison({ petition }: { petition: Petition }) {
  const checks = responseChecksFor(petition);
  const hasResponse = petition.responses.some(
    (response) => response.verification === 'verified' && !response.removed,
  );
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.h2}>Did they answer the request?</Text>
      <Text style={styles.muted}>
        The organizer compares each specific ask with a recorded response. This assesses the words
        in the response, not whether work was completed.
      </Text>
      {checks.map((check, index) => {
        const response = petition.responses.find(
          (item) =>
            item.id === check.responseId && item.verification === 'verified' && !item.removed,
        );
        const status = response ? check.status : 'not_reviewed';
        return (
          <View
            key={`${index}-${check.ask}`}
            style={{ padding: 16, borderRadius: 14, backgroundColor: '#F5F5F1', gap: 8 }}
          >
            <Text style={styles.label}>ASK {index + 1}</Text>
            <Text style={styles.body}>{check.ask}</Text>
            <Chip label={responseCheckStatusLabels[status]} />
            {response ? (
              <>
                <Text style={styles.small}>
                  Compared with {response.organization}
                  {response.organization.includes('(fictional)') ? ' · fictional sample' : ''}.
                </Text>
                {check.note ? <Text style={styles.body}>{check.note}</Text> : null}
                <Text style={styles.muted}>
                  Assessed by {check.reviewedBy ?? 'the organizer'}
                  {check.reviewedAt ? ` · ${new Date(check.reviewedAt).toLocaleDateString()}` : ''}
                </Text>
              </>
            ) : null}
          </View>
        );
      })}
      {!hasResponse ? (
        <Text style={styles.small}>
          Waiting for a verified response before an assessment can be published.
        </Text>
      ) : checks.every((check) => check.status === 'not_reviewed') ? (
        <Text style={styles.small}>
          A response is on record. The organizer has not compared it with these asks yet.
        </Text>
      ) : null}
    </View>
  );
}

export function ResponseCheckEditor({ petition }: { petition: Petition }) {
  const mutation = useCommand();
  const verified = petition.responses.filter(
    (response) => response.verification === 'verified' && !response.removed,
  );
  const [selectedResponseId, setSelectedResponseId] = useState(verified[0]?.id ?? '');
  const [checks, setChecks] = useState<ResponseCheck[]>(() =>
    responseChecksFor(petition).map((check) =>
      check.responseId && !verified.some((response) => response.id === check.responseId)
        ? { ask: check.ask, status: 'not_reviewed', note: '' }
        : { ...check },
    ),
  );
  const [saved, setSaved] = useState(false);
  const parsed = responseChecksSchema.safeParse(checks);
  const change = (index: number, patch: Partial<ResponseCheck>) => {
    setSaved(false);
    setChecks((current) =>
      current.map((check, i) => (i === index ? { ...check, ...patch } : check)),
    );
  };
  return (
    <Panel>
      <Text style={styles.h2}>Compare request and response</Text>
      <Text style={styles.muted}>
        Break the requested action into up to three checkable asks. Mark only what the verified
        response actually says. An answer is not evidence that the work happened. Your comparison
        and changes are public.
      </Text>
      {verified.length ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>RESPONSE TO COMPARE</Text>
          {verified.map((response) => (
            <Button
              key={response.id}
              title={`${selectedResponseId === response.id ? '✓ ' : ''}${response.organization} · ${new Date(response.date).toLocaleDateString()}`}
              variant="secondary"
              onPress={() => setSelectedResponseId(response.id)}
            />
          ))}
        </View>
      ) : (
        <Notice text="No verified response is available yet. You can define the asks now and review them after a response is verified." />
      )}
      {checks.map((check, index) => (
        <View key={index} style={{ gap: 10, paddingVertical: 12 }}>
          <Field
            label={`Ask ${index + 1}`}
            value={check.ask}
            onChangeText={(ask) => change(index, { ask })}
          />
          <View style={{ gap: 8 }}>
            {(['not_reviewed', ...assessedStatuses] as ResponseCheck['status'][]).map((status) => (
              <Button
                key={status}
                title={`${check.status === status ? '✓ ' : ''}${responseCheckStatusLabels[status]}`}
                variant="secondary"
                disabled={status !== 'not_reviewed' && !selectedResponseId}
                onPress={() =>
                  change(index, {
                    status,
                    responseId: status === 'not_reviewed' ? undefined : selectedResponseId,
                    note: status === 'not_reviewed' ? '' : check.note,
                  })
                }
              />
            ))}
          </View>
          {check.status !== 'not_reviewed' ? (
            <Field
              label="Why does the response earn this status?"
              multiline
              value={check.note}
              onChangeText={(note) => change(index, { note })}
            />
          ) : null}
          {checks.length > 1 ? (
            <Button
              title={`Remove ask ${index + 1}`}
              variant="ghost"
              onPress={() => setChecks((current) => current.filter((_, i) => i !== index))}
            />
          ) : null}
        </View>
      ))}
      {checks.length < 3 ? (
        <Button
          title="Add another ask"
          variant="secondary"
          onPress={() =>
            setChecks((current) => [...current, { ask: '', status: 'not_reviewed', note: '' }])
          }
        />
      ) : null}
      {!parsed.success ? (
        <Notice error text={parsed.error.issues[0]?.message ?? 'Review the asks.'} />
      ) : null}
      {mutation.error ? <Notice error text={mutation.error.message} /> : null}
      {saved ? (
        <Notice text="The public request-to-response comparison was saved with an edit-history entry." />
      ) : null}
      <Button
        title="Save public comparison"
        disabled={!parsed.success || mutation.isPending}
        onPress={() =>
          mutation.mutate(
            { type: 'responseChecks', petitionId: petition.id, checks },
            { onSuccess: () => setSaved(true) },
          )
        }
      />
    </Panel>
  );
}
