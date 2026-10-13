import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Community,
  CommunityPost,
  CommunitySpace,
  Petition,
  PostKind,
  Profile,
  postKindLabels,
} from '../domain/model';
import { isDemo, useBackend, useCommand } from '../data/provider';
import { Button, Chip, Confirm, Field, Notice, colors, fonts, styles } from './ui';
import { Initials, PillChip, Rail, initialsOf, toast } from './kit';
import { Composer as PostBox } from './entries';
import { stag } from './motion';

const badge = {
  fontFamily: fonts.semibold,
  fontSize: 11,
  letterSpacing: 0.8,
  textTransform: 'uppercase' as const,
  color: colors.accent,
  backgroundColor: colors.soft,
  paddingVertical: 3,
  paddingHorizontal: 7,
  borderRadius: 999,
  overflow: 'hidden' as const,
};

/**
 * Every community surface is the same record filtered three ways: which space it lives in, what
 * kind it is, and which channel it was posted to. One list, one composer, a few views.
 */
const views = [
  {
    id: 'Discussion',
    space: 'discussion',
    kinds: ['question', 'idea', 'experience'],
    moderatorOnly: false,
  },
  { id: 'Announcements', space: 'announcements', kinds: ['announcement'], moderatorOnly: false },
  { id: 'Events', space: 'discussion', kinds: ['event'], moderatorOnly: false },
  {
    id: 'Organizer space',
    space: 'organizers',
    kinds: ['question', 'idea', 'event'],
    moderatorOnly: true,
  },
] as const satisfies readonly {
  id: string;
  space: CommunitySpace;
  kinds: readonly PostKind[];
  moderatorOnly?: boolean;
}[];
type ViewId = (typeof views)[number]['id'];

const blurbs: Record<ViewId | 'Campaign updates' | 'Reports', string> = {
  Discussion: 'Anyone can read this. Members post questions, ideas and first-hand experience.',
  Announcements:
    'Posted in the community’s voice by its owner and moderators. Members read but do not post here.',
  Events: `Meetups, walk-throughs and hearings, soonest first.${isDemo ? ' Fictional demo events.' : ''}`,
  'Organizer space':
    'A private working room for the owner and moderators. Members cannot read this space.',
  'Campaign updates':
    'Updates written by the organizers of this community\u2019s petitions. Read-only here \u2014 they are posted from the petition, and everyone who saved or signed it is notified.',
  Reports:
    'Reports on posts in this community. The reporter is never named to you: reporting a neighbour should not become a confrontation.',
};

function Post({
  post,
  index,
  profile,
  joined,
  moderates,
  onRemove,
  onReport,
}: {
  post: CommunityPost;
  index: number;
  profile: Profile | null;
  joined: boolean;
  moderates: boolean;
  onRemove: (post: CommunityPost) => void;
  onReport: (post: CommunityPost) => void;
}) {
  const when = post.kind === 'event' && post.eventAt ? new Date(post.eventAt) : null;
  return (
    <Animated.View style={stag(index)}>
      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: 24,
          padding: 16,
          flexDirection: 'row',
          gap: 12,
        }}
      >
        <Initials
          text={when ? String(when.getDate()) : initialsOf(post.author)}
          size={36}
          bg={when ? colors.dark : colors.pale}
          fg={when ? colors.pale : colors.accent}
        />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>
              {post.author}
            </Text>
            <Text style={badge}>{postKindLabels[post.kind as PostKind] ?? post.kind}</Text>
            {!!post.channel && (
              <Text style={[styles.micro, { fontSize: 11 }]}>#{post.channel}</Text>
            )}
          </View>
          <Text
            style={{
              fontFamily: post.removed ? fonts.italic : fonts.body,
              fontSize: 13,
              lineHeight: 21,
              color: post.removed ? colors.muted : colors.secondary,
            }}
          >
            {post.body}
          </Text>
          {when && (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.accent }}>
              {when.toLocaleString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
              {post.location ? ` · ${post.location}` : ''}
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.outline }}>
              {new Date(post.date).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
            {!post.removed && (moderates || (!!profile && post.authorId === profile.id)) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove post"
                hitSlop={10}
                onPress={() => onRemove(post)}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.error }}>
                  Remove
                </Text>
              </Pressable>
            )}
            {!post.removed && joined && !!profile && post.authorId !== profile.id && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Report post"
                hitSlop={10}
                onPress={() => onReport(post)}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.muted }}>
                  Report
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

function Composer({
  community,
  view,
  channel,
}: {
  community: Community;
  view: (typeof views)[number];
  channel: string;
}) {
  const m = useCommand();
  const [kind, setKind] = useState<PostKind>(view.kinds[0]);
  const [body, setBody] = useState('');
  const [eventAt, setEventAt] = useState('');
  const [location, setLocation] = useState('');
  const [newChannel, setNewChannel] = useState(channel);
  return (
    <View style={{ gap: 8 }}>
      {view.kinds.length > 1 && (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {view.kinds.map((k) => (
            <PillChip
              key={k}
              label={postKindLabels[k]}
              height={32}
              selected={kind === k}
              onPress={() => setKind(k)}
            />
          ))}
        </View>
      )}
      <View style={{ backgroundColor: colors.white, borderRadius: 24, padding: 8 }}>
        <PostBox
          bare
          value={body}
          onChange={setBody}
          placeholder={
            kind === 'event'
              ? 'What is happening, and why come?'
              : 'Share a question, idea or experience'
          }
          pending={m.isPending}
          onSubmit={() =>
            m.mutate(
              {
                type: 'communityPost',
                communityId: community.id,
                body,
                kind,
                space: view.space,
                channel: newChannel.trim(),
                ...(kind === 'event'
                  ? { eventAt: eventAt.trim().replace(' ', 'T'), location }
                  : {}),
              },
              {
                onSuccess: () => {
                  setBody('');
                  setEventAt('');
                  setLocation('');
                  toast(`Posted to ${community.name}.`);
                },
              },
            )
          }
        />
      </View>
      {kind === 'event' && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field
              label="When (YYYY-MM-DD HH:MM)"
              value={eventAt}
              onChangeText={setEventAt}
              placeholder="2026-10-04 18:30"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Where"
              value={location}
              onChangeText={setLocation}
              placeholder="Library steps"
            />
          </View>
        </View>
      )}
      <Field
        label="Channel (optional)"
        value={newChannel}
        onChangeText={setNewChannel}
        placeholder="lighting"
      />
      {m.error && <Notice error text={m.error.message} />}
    </View>
  );
}

function Reports({ community }: { community: Community }) {
  const { adapter } = useBackend();
  const m = useCommand();
  const q = useQuery({
    queryKey: ['community-reports', community.id],
    queryFn: () => adapter.communityReports(community.id),
  });
  if (q.isPending) return <Text style={styles.muted}>Loading reports…</Text>;
  if (q.error) return <Notice error text={q.error.message} />;
  if (!q.data?.length) return <Text style={styles.muted}>No posts have been reported.</Text>;
  return (
    <>
      {q.data.map((r) => (
        <View
          key={r.id}
          style={{ gap: 6, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.line }}
        >
          <View style={[styles.row, { gap: 8 }]}>
            <Chip label={r.status} />
            <Text style={styles.micro}>{new Date(r.date).toLocaleDateString()}</Text>
          </View>
          <Text style={styles.body}>{r.reason}</Text>
          <Text style={styles.small}>
            Reported post by {r.postAuthor}: “{r.postBody}”
          </Text>
          {r.status === 'open' && (
            <View style={styles.row}>
              <Button
                title="Mark actioned"
                variant="secondary"
                disabled={m.isPending}
                onPress={() =>
                  m.mutate({
                    type: 'resolvePostReport',
                    communityId: community.id,
                    reportId: r.id,
                    action: 'actioned',
                  })
                }
              />
              <Button
                title="Dismiss"
                variant="ghost"
                disabled={m.isPending}
                onPress={() =>
                  m.mutate({
                    type: 'resolvePostReport',
                    communityId: community.id,
                    reportId: r.id,
                    action: 'dismissed',
                  })
                }
              />
            </View>
          )}
          {m.error && <Notice error text={m.error.message} />}
        </View>
      ))}
      <Notice text="Marking a report actioned records the review. Removing the post itself is a separate, visible step so the thread keeps its tombstone." />
    </>
  );
}

function CampaignUpdates({ petitions }: { petitions: Petition[] }) {
  const updates = petitions
    .flatMap((p) => p.updates.map((u) => ({ ...u, title: p.title, petitionId: p.id })))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  if (!updates.length)
    return (
      <Text style={styles.muted}>
        No organizer has posted an update on this community’s petitions yet.
      </Text>
    );
  return (
    <>
      {updates.map((u, i) => (
        <Animated.View key={u.id} style={stag(i)}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open ${u.title}`}
            onPress={() => router.push(`/petition/${u.petitionId}`)}
            style={{
              backgroundColor: colors.white,
              borderRadius: 24,
              padding: 16,
              flexDirection: 'row',
              gap: 12,
            }}
          >
            <Initials text="↗" size={36} />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <View
                style={{ flexDirection: 'row', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>
                  {u.title}
                </Text>
                <Text style={badge}>update</Text>
              </View>
              <Text
                style={{
                  fontFamily: u.removed ? fonts.italic : fonts.body,
                  fontSize: 13,
                  lineHeight: 21,
                  color: u.removed ? colors.muted : colors.secondary,
                }}
              >
                {u.body}
              </Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.outline }}>
                {u.author} ·{' '}
                {new Date(u.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      ))}
    </>
  );
}

export function CommunityWorkspace({
  community,
  petitions,
  profile,
  joined,
  moderates,
}: {
  community: Community;
  /** This community's petitions, for the read-only campaign-updates zone. */
  petitions: Petition[];
  profile: Profile | null;
  joined: boolean;
  moderates: boolean;
}) {
  const { adapter } = useBackend();
  const m = useCommand();
  const posts = useQuery({
    queryKey: ['posts', community.id],
    queryFn: () => adapter.communityPosts(community.id),
  });
  const [view, setView] = useState<ViewId | 'Campaign updates' | 'Reports'>('Discussion');
  const [channel, setChannel] = useState('');
  const [removing, setRemoving] = useState<CommunityPost | null>(null);
  const [reporting, setReporting] = useState<CommunityPost | null>(null);
  const [reason, setReason] = useState('');
  const active = views.find((v) => v.id === view);
  const all = posts.data ?? [];
  const inView = active
    ? all.filter(
        (p) => p.space === active.space && (active.kinds as readonly string[]).includes(p.kind),
      )
    : [];
  // Channels are whatever people have actually used, not a fixed list an admin has to curate.
  const channels = [...new Set(inView.map((p) => p.channel).filter(Boolean))];
  const shown = (channel ? inView.filter((p) => p.channel === channel) : inView).sort((a, b) =>
    active?.id === 'Events'
      ? Date.parse(a.eventAt ?? a.date) - Date.parse(b.eventAt ?? b.date)
      : Date.parse(b.date) - Date.parse(a.date),
  );
  const canPost = joined && (moderates || active?.space === 'discussion');
  const zones: (ViewId | 'Campaign updates' | 'Reports')[] = [
    ...views.filter((v) => !v.moderatorOnly || moderates).map((v) => v.id),
    'Campaign updates',
    ...(moderates ? (['Reports'] as const) : []),
  ];
  return (
    <View style={{ gap: 10 }}>
      <Rail style={{ marginTop: 18 }}>
        {zones.map((z) => (
          <PillChip
            key={z}
            label={z}
            height={36}
            selected={view === z}
            onPress={() => {
              setView(z);
              setChannel('');
            }}
          />
        ))}
      </Rail>
      <Text style={[styles.small, { paddingTop: 4 }]}>{blurbs[view]}</Text>
      {view === 'Campaign updates' ? (
        <CampaignUpdates petitions={petitions} />
      ) : view === 'Reports' ? (
        <Reports community={community} />
      ) : (
        <>
          {canPost && active && (
            // Keyed by view: the composer picks its default kind from the view it belongs to, so
            // switching from Discussion to Events has to give it a fresh state.
            <Composer key={active.id} community={community} view={active} channel={channel} />
          )}
          {joined && !canPost && (
            <Notice text="Only this community’s owner and moderators post here." />
          )}
          {!joined && <Notice text="Join this community to take part." />}
          {channels.length > 0 && (
            <Rail>
              <PillChip
                label="All channels"
                height={32}
                selected={!channel}
                onPress={() => setChannel('')}
              />
              {channels.map((c) => (
                <PillChip
                  key={c}
                  label={`#${c}`}
                  height={32}
                  selected={channel === c}
                  onPress={() => setChannel(c)}
                />
              ))}
            </Rail>
          )}
          {posts.isPending ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : posts.error ? (
            <Notice error text={posts.error.message} />
          ) : shown.length ? (
            shown.map((p, i) => (
              <Post
                key={p.id}
                post={p}
                index={i}
                profile={profile}
                joined={joined}
                moderates={moderates}
                onRemove={setRemoving}
                onReport={(post) => {
                  setReason('');
                  setReporting(post);
                }}
              />
            ))
          ) : (
            <Text style={styles.muted}>Nothing here yet. Be the first.</Text>
          )}
        </>
      )}
      <Confirm
        visible={removing !== null}
        title="Remove this post?"
        body="The post is replaced with a visible note saying it was removed, so the conversation stays honest. This cannot be undone."
        pending={m.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          m.mutate(
            {
              type: 'removeEntry',
              scope: 'communityPost',
              entryId: removing.id,
              communityId: community.id,
            },
            { onSuccess: () => setRemoving(null) },
          )
        }
      >
        {m.error && <Notice error text={m.error.message} />}
      </Confirm>
      <Confirm
        visible={reporting !== null}
        title="Report this post?"
        body="This community’s owner and moderators will read your reason. Your name is not shown to them."
        pending={m.isPending}
        onCancel={() => setReporting(null)}
        onConfirm={() =>
          reporting &&
          m.mutate(
            {
              type: 'reportPost',
              communityId: community.id,
              postId: reporting.id,
              reason,
            },
            { onSuccess: () => setReporting(null) },
          )
        }
      >
        <Field
          label="What is wrong with this post?"
          multiline
          value={reason}
          onChangeText={setReason}
        />
        {m.error && <Notice error text={m.error.message} />}
      </Confirm>
    </View>
  );
}
