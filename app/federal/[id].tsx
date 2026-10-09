import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useFederalRules } from '../../src/data/federal';
import { daysLeft } from '../../src/domain/federal';
import { closingLabel } from '../../src/components/federal-card';
import { TopicPill, toast } from '../../src/components/kit';
import { Button, Confirm, Loading, Notice, Page, Panel, styles } from '../../src/components/ui';

/**
 * A real proposed federal rule. Swipe4Change only points to it: the comment itself is written and
 * sent on the government's own site.
 */
export default function FederalRuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useFederalRules();
  const [now] = useState(Date.now);
  const [leaving, setLeaving] = useState<string | null>(null);
  if (q.isPending) return <Loading variant="detail" />;
  const rule = q.data?.find((r) => r.id === id);
  const leave = (
    <Confirm
      visible={!!leaving}
      title="Leave Swipe4Change?"
      body={`This opens ${leaving ? new URL(leaving).hostname : ''}, a U.S. government site. Swipe4Change can’t see, send or store anything you write there.`}
      confirmLabel="Continue"
      onCancel={() => setLeaving(null)}
      onConfirm={() => {
        const url = leaving;
        setLeaving(null);
        if (url)
          void Linking.openURL(url).catch(() =>
            toast('Unable to open the page. Try again from a browser.'),
          );
      }}
    />
  );
  if (!rule)
    return (
      <Page
        back
        eyebrow="FEDERAL RULE"
        title={q.isError ? 'We couldn’t reach the Federal Register' : 'Not open for comment here'}
        subtitle={
          q.isError
            ? 'Check your connection and try again.'
            : 'Its comment period may have ended, or it is outside the topics Swipe4Change follows.'
        }
      >
        {q.isError ? (
          <Button title="Try again" onPress={() => void q.refetch()} />
        ) : (
          <Button
            title="Read it on the Federal Register"
            onPress={() =>
              setLeaving(`https://www.federalregister.gov/d/${encodeURIComponent(id ?? '')}`)
            }
          />
        )}
        {leave}
      </Page>
    );
  const closes = new Date(`${rule.closesOn}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return (
    <Page back eyebrow="FEDERAL RULE · OPEN FOR COMMENT" title={rule.title} subtitle={rule.agency}>
      <View style={styles.row}>
        <TopicPill topic={rule.topic} />
      </View>
      <Panel>
        <Text accessibilityRole="header" style={styles.h3}>
          Comments close {closes}
        </Text>
        <Text style={styles.small}>
          {closingLabel(daysLeft(rule.closesOn, now))}. Applies nationwide. Run by the federal
          government, not Swipe4Change.
        </Text>
      </Panel>
      <Panel>
        <Text accessibilityRole="header" style={styles.h3}>
          Official summary from the Federal Register
        </Text>
        <Text style={styles.small}>
          {rule.summary ||
            'The agency did not publish a summary. Read the full proposal on the Federal Register.'}
        </Text>
      </Panel>
      <Button
        title={rule.commentUrl ? 'Comment on Regulations.gov' : 'Read on the Federal Register'}
        onPress={() => setLeaving(rule.commentUrl ?? rule.url)}
      />
      {!!rule.commentUrl && (
        <Button
          title="Read the full proposal"
          variant="secondary"
          onPress={() => setLeaving(rule.url)}
        />
      )}
      <Notice text="Comments on Regulations.gov are usually published, along with any name you give. Write in your own words and leave out anything you wouldn’t want public." />
      {leave}
    </Page>
  );
}
