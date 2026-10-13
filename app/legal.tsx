import { Text } from 'react-native';
import { Panel, Page, styles } from '../src/components/ui';
import { isDemo } from '../src/data/provider';

/** A dedicated contact address for the people running the app (set in Vercel), if any. */
const contact = process.env.EXPO_PUBLIC_CONTACT_EMAIL;

/**
 * Terms and privacy in plain language. Every statement here describes what the code actually
 * does; change this page whenever data handling changes.
 */
const sections: [string, string[]][] = [
  [
    'Who runs this',
    [
      'Swipe4Change is a student project built for the Congressional App Challenge. It is not a government service and is not affiliated with any office, party or campaign.',
    ],
  ],
  ...(isDemo
    ? []
    : ([
        [
          'Public beta',
          [
            'Swipe4Change is in a public beta. Sign-in is open to the first 100 accounts. When the full version launches, accounts may need to sign up again, and petitions and signatures from the beta may not carry over.',
          ],
        ],
      ] satisfies [string, string[]][])),
  [
    'Who can use it',
    [
      'You must be 13 or older to create an account. If you are under 18, ask a parent or guardian to look over these terms with you.',
    ],
  ],
  [
    'What we store',
    [
      'Sign-in is handled by Clerk, which keeps your email address and password. Our database never receives your email; it stores an anonymous account ID, the display name you choose, your approximate city and state, your interests, an optional bio, and whether your email is verified.',
      'When you sign a petition we store the public identity you chose (full name, first name and last initial, or anonymous) and a private receipt of your drawn signature and the exact text you signed. Organizers and the public see only the identity you chose, never your email, contact details or account ID.',
      'Petitions, updates, discussion posts and photos you publish are public and show your display name. Photos have location and camera details removed before upload.',
    ],
  ],
  [
    'Location',
    [
      'We save only “City, ST”. If you use your current location, the app reads one approximate position, rounds it to about a kilometre, asks OpenStreetMap which city it is in, and discards it.',
    ],
  ],
  [
    'AI features',
    [
      'The public wording of petitions is checked by Anthropic’s Claude for spam and abuse and tagged for recommendations. If you use “Write it for me” or the recipient finder, the text you type is sent to Claude. Information about who you are is never sent.',
      'The “For you” feed learns from what you open, read and swipe. Those signals stay on your device, and you can turn them off or clear them in Profile.',
    ],
  ],
  [
    'Federal rules',
    [
      'Federal rules open for comment come from the Federal Register, a public U.S. government source. Commenting happens on Regulations.gov or the agency’s own site, under their privacy policies, not ours.',
    ],
  ],
  [
    'Deleting your account',
    [
      'Profile → Delete account removes your signatures, saves, memberships, drafts, notifications and private records, and takes your petitions out of public view. Public posts and updates you wrote stay, credited to “Deleted account”, so conversations still make sense.',
    ],
  ],
  [
    'Rules for using Swipe4Change',
    [
      'Be truthful. Do not post threats, harassment, hateful content, spam, or private information about anyone. Do not pretend to be someone else or sign for another person.',
      'Petitions may be held or hidden automatically while they are checked, and content that breaks these rules may be removed.',
      'A signature here shows support. It is not a legal document unless the recipient chooses to treat it as one. Swipe4Change does not process payments or fundraise; donation links go to pages organizers run themselves.',
      'The app is provided as is, without guarantees that it will always be available or error-free.',
    ],
  ],
  [
    'Questions',
    [
      contact
        ? `Email ${contact}. To flag a petition, use Report a concern on its page. Last updated October 12, 2026.`
        : 'To flag a petition, use Report a concern on its page. Last updated October 12, 2026.',
    ],
  ],
];

export default function Legal() {
  return (
    <Page
      back
      eyebrow="TERMS AND PRIVACY"
      title="Plain-language terms"
      subtitle="What Swipe4Change stores, what it never stores, and the rules for using it."
    >
      {sections.map(([heading, paragraphs]) => (
        <Panel key={heading}>
          <Text accessibilityRole="header" style={styles.h3}>
            {heading}
          </Text>
          {paragraphs.map((paragraph) => (
            <Text key={paragraph.slice(0, 24)} style={styles.small}>
              {paragraph}
            </Text>
          ))}
        </Panel>
      ))}
    </Page>
  );
}
