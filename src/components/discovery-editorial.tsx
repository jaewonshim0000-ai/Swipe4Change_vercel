import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Snapshot } from '../domain/model';
import { isDemo } from '../data/provider';
import { Button, Icon, Panel, colors, fonts, styles, tokens } from './ui';

export function DiscoveryHero({ snapshot }: { snapshot: Snapshot }) {
  const { width } = useWindowDimensions();
  const featured = snapshot.petitions.find((p) => p.status === 'active');
  return (
    <View style={{ gap: 32 }}>
      <View
        style={{
          flexDirection: width >= 1000 ? 'row' : 'column',
          alignItems: 'center',
          gap: 48,
          paddingVertical: width < 600 ? 8 : 24,
        }}
      >
        <View style={{ flex: 1.25, width: '100%', gap: 20 }}>
          <View
            style={[
              styles.row,
              {
                gap: 8,
                flexWrap: 'nowrap',
                alignSelf: 'flex-start',
                paddingVertical: 6,
                paddingHorizontal: 12,
                backgroundColor: colors.pale,
                borderRadius: 12,
              },
            ]}
          >
            <Icon name="leaf-outline" size={16} />
            <Text
              style={[
                styles.label,
                { fontSize: 10, letterSpacing: 0.7, color: colors.secondary, flexShrink: 1 },
              ]}
            >
              {isDemo
                ? 'A fictional community. Real possibilities.'
                : 'Small actions. Shared progress.'}
            </Text>
          </View>
          <Text
            accessibilityRole="header"
            style={[
              styles.title,
              {
                fontSize: width < 600 ? 38 : 56,
                lineHeight: width < 600 ? 44 : 60,
                letterSpacing: -1.1,
              },
            ]}
          >
            Turn shared concerns into{' '}
            <Text style={{ fontFamily: fonts.italic, color: colors.accent }}>lasting</Text> change.
          </Text>
          <Text
            style={[
              styles.body,
              { maxWidth: 590, fontSize: width < 600 ? 16 : 18, lineHeight: 28 },
            ]}
          >
            Safer streets. Stronger neighborhoods. Discover the causes you care about, add your
            voice, and build a better community together.
          </Text>
          <View style={styles.row}>
            <Button
              title="Start a petition"
              icon="arrow-forward"
              onPress={() => router.push('/(tabs)/create')}
            />
            <Button
              title="Explore petitions"
              icon="compass-outline"
              variant="secondary"
              onPress={() => router.push('/(tabs)/explore')}
            />
          </View>
          <View style={[styles.row, { gap: 8, flexWrap: 'nowrap' }]}>
            <Icon name="shield-checkmark-outline" size={16} />
            <Text style={[styles.muted, { flexShrink: 1 }]}>
              Your community. Your voice. Your choice.
            </Text>
          </View>
        </View>
        {width >= 1000 && featured && (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Featured petition: ${featured.title}`}
            onPress={() => router.push(`/petition/${featured.id}`)}
            style={({ pressed }) => ({
              flex: 1,
              width: '100%',
              borderRadius: tokens.radius,
              overflow: 'hidden',
              backgroundColor: colors.white,
              borderWidth: 1,
              borderColor: colors.line,
              opacity: pressed ? 0.85 : 1,
              ...tokens.shadow,
            })}
          >
            <Image
              source={require('../../assets/theme/civic-gathering.jpg')}
              accessibilityLabel="Community gathering — illustrative theme image"
              style={{ width: '100%', height: 230 }}
              resizeMode="cover"
            />
            <View style={{ padding: 20, backgroundColor: colors.secondary, gap: 8 }}>
              <Text style={[styles.label, { color: colors.pale, fontSize: 10 }]}>
                {isDemo ? 'FICTIONAL COMMUNITY SPOTLIGHT' : 'COMMUNITY SPOTLIGHT'} · ILLUSTRATIVE
                IMAGE
              </Text>
              <Text style={[styles.h2, { color: colors.white }]}>{featured.title}</Text>
            </View>
            <View style={[styles.between, { padding: 20 }]}>
              <View style={{ gap: 4 }}>
                <Text style={styles.muted}>{isDemo ? 'Sample signatures' : 'Signatures'}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 30, color: colors.accent }}>
                  {featured.count.toLocaleString()}
                </Text>
              </View>
              <View style={[styles.row, { gap: 8 }]}>
                <Text style={[styles.muted, { color: colors.accent, fontFamily: fonts.semibold }]}>
                  Read the petition
                </Text>
                <Icon name="arrow-forward" size={18} />
              </View>
            </View>
          </Pressable>
        )}
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.line,
          paddingVertical: 24,
          rowGap: 24,
        }}
      >
        {[
          [
            String(snapshot.petitions.filter((p) => p.status === 'active').length),
            'Active petitions',
            isDemo ? 'Fictional causes to explore' : 'Find your next cause',
          ],
          [String(snapshot.communities.length), 'Local communities', 'Find people who care'],
          [
            String(new Set(snapshot.petitions.map((p) => p.topic)).size),
            'Topics that matter',
            'From streets to schools',
          ],
          ['Your choice', 'Public identity', 'Within each petition’s rules'],
        ].map(([value, label, caption], i) => (
          <View
            key={label}
            style={{
              width: width < 700 ? '50%' : '25%',
              paddingHorizontal: 12,
              alignItems: 'center',
              borderLeftWidth: i % (width < 700 ? 2 : 4) === 0 ? 0 : 1,
              borderLeftColor: colors.line,
              gap: 4,
            }}
          >
            <Text
              style={{
                fontFamily: i === 3 ? fonts.heading : fonts.bold,
                fontSize: width < 600 ? 24 : 30,
                color: i === 1 ? colors.accent : colors.ink,
              }}
            >
              {value}
            </Text>
            <Text
              style={[
                styles.muted,
                { fontFamily: fonts.semibold, color: colors.ink, textAlign: 'center' },
              ]}
            >
              {label}
            </Text>
            <Text style={[styles.muted, { fontSize: 12, textAlign: 'center' }]}>{caption}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function DiscoveryFooter({ snapshot }: { snapshot: Snapshot }) {
  const { width } = useWindowDimensions();
  return (
    <View style={{ gap: 40, paddingTop: 16 }}>
      <View
        style={{
          gap: 20,
          padding: width < 600 ? 16 : 32,
          backgroundColor: colors.pale,
          borderRadius: tokens.radius,
        }}
      >
        <View style={styles.between}>
          <View style={{ gap: 8 }}>
            <Text style={styles.label}>CHANGE STARTS CLOSE TO HOME</Text>
            <Text style={styles.h2}>Find your people.</Text>
          </View>
          <Button
            title="All communities"
            variant="secondary"
            icon="arrow-forward"
            onPress={() => router.push('/(tabs)/communities')}
          />
        </View>
        <View style={{ flexDirection: width < 900 ? 'column' : 'row', gap: 16 }}>
          {snapshot.communities.slice(0, 3).map((community) => (
            <Pressable
              key={community.id}
              accessibilityRole="link"
              accessibilityLabel={`Explore ${community.name}`}
              onPress={() => router.push(`/community/${community.id}`)}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: colors.white,
                padding: 20,
                borderRadius: tokens.radius,
                gap: 12,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Icon name="people-outline" size={24} />
              <Text style={styles.h3}>{community.name}</Text>
              <Text style={styles.muted}>
                {community.members.toLocaleString()} {isDemo ? 'sample members' : 'members'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ gap: 24 }}>
        <View style={{ gap: 8, alignItems: 'center' }}>
          <Text style={styles.label}>A SMALL ACT. A CLEAR NEXT STEP.</Text>
          <Text style={[styles.h2, { textAlign: 'center', fontSize: 32, lineHeight: 40 }]}>
            Make your voice part of the story.
          </Text>
        </View>
        <View style={{ flexDirection: width < 900 ? 'column' : 'row', gap: 24 }}>
          {[
            [
              '1',
              'Discover what matters',
              'Explore local petitions and understand the request, the recipient, and the evidence before you act.',
            ],
            [
              '2',
              'Choose how to participate',
              'Review signing requirements and choose an allowed public identity. Signing always needs your confirmation.',
            ],
            [
              '3',
              'Follow the next step',
              'Join your community, read organizer updates, and track the progress of causes you care about.',
            ],
          ].map(([number, title, body]) => (
            <Panel key={number} style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.heading, fontSize: 28, color: colors.accent }}>
                {number.padStart(2, '0')}
              </Text>
              <Text style={styles.h3}>{title}</Text>
              <Text style={styles.muted}>{body}</Text>
            </Panel>
          ))}
        </View>
      </View>
      <View
        style={{
          backgroundColor: colors.ink,
          borderRadius: tokens.radius,
          padding: width < 600 ? 24 : 40,
          gap: 20,
        }}
      >
        <Text style={[styles.label, { color: colors.pale }]}>YOUR VOICE BELONGS HERE</Text>
        <Text
          style={[
            styles.title,
            {
              color: colors.white,
              maxWidth: 760,
              fontSize: width < 600 ? 32 : 44,
              lineHeight: width < 600 ? 40 : 52,
            },
          ]}
        >
          A better neighborhood starts with someone like you.
        </Text>
        <Text style={[styles.body, { color: colors.pale, maxWidth: 660 }]}>
          Turn something you’ve noticed into a clear request for change. Our guided builder helps
          you take the first step.
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            title="Start your petition"
            icon="arrow-forward"
            onPress={() => router.push('/(tabs)/create')}
          />
        </View>
      </View>
    </View>
  );
}
