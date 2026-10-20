import { Text, View } from 'react-native';
import type { Petition, Snapshot } from '../domain/model';
import { backingQuorum } from '../domain/rules';
import { useCommand } from '../data/provider';
import { toast } from './kit';
import { Button, colors, fonts, styles } from './ui';

const card = { backgroundColor: colors.white, borderRadius: 24, padding: 18, gap: 10 };

/**
 * Which communities voted to back this petition, and a yes or no for each community you belong to
 * that has not decided yet. Only totals are shown; nobody sees how anyone else voted.
 */
export function CommunityBacking({ p, s }: { p: Petition; s: Snapshot }) {
  const mutation = useCommand();
  const community = (id: string) => s.communities.find((c) => c.id === id);
  const backed = p.backing.filter((b) => b.backedAt && community(b.communityId));
  const open =
    p.status === 'active'
      ? (s.profile?.joined ?? []).filter(
          (id) => community(id) && !backed.some((b) => b.communityId === id),
        )
      : [];
  if (!backed.length && !open.length) return null;
  const vote = (communityId: string, support: boolean) =>
    mutation.mutate(
      { type: 'backVote', petitionId: p.id, communityId, support },
      {
        onSuccess: (result) =>
          toast(
            result === 'backed'
              ? `${community(communityId)?.name} now backs this petition.`
              : 'Vote recorded. Only the totals are public.',
          ),
        onError: (e) => toast(e.message),
      },
    );
  return (
    <View style={[card, { marginTop: 12 }]}>
      <Text
        style={{ fontFamily: fonts.heading, fontSize: 18, lineHeight: 22.5, color: colors.ink }}
      >
        Community backing
      </Text>
      {backed.map((b) => (
        <Text
          key={b.communityId}
          style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}
        >
          ★ Backed by {community(b.communityId)?.name}
          {b.yes + b.no > 0 && (
            <Text style={styles.muted}>
              {' '}
              · members voted {b.yes} yes · {b.no} no
            </Text>
          )}
        </Text>
      ))}
      {open.map((id) => {
        const tally = p.backing.find((b) => b.communityId === id) ?? { yes: 0, no: 0 };
        const mine = s.backingVotes.find((v) => v.petitionId === p.id && v.communityId === id);
        return (
          <View key={id} style={{ gap: 8 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>
              Should {community(id)?.name} back this?
            </Text>
            <Text style={styles.small}>
              {tally.yes} yes · {tally.no} no so far. It needs {backingQuorum} yes votes and more
              yes than no.{' '}
              {mine ? `You voted ${mine.support ? 'yes' : 'no'}; you can change it.` : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([true, false] as const).map((support) => (
                <Button
                  key={String(support)}
                  title={`${support ? 'Yes' : 'No'}${mine?.support === support ? ' ✓' : ''}`}
                  variant={mine?.support === support ? 'primary' : 'secondary'}
                  disabled={mutation.isPending || mine?.support === support}
                  onPress={() => vote(id, support)}
                  style={{ flex: 1 }}
                />
              ))}
            </View>
          </View>
        );
      })}
      <Text style={styles.small}>
        Backing goes into the packet sent to the recipient. Votes are private; only totals show.
      </Text>
    </View>
  );
}
