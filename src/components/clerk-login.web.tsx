import { SignIn, SignUp } from '@clerk/expo/web';
import { colors, fonts } from './theme';

const appearance = {
  variables: {
    colorPrimary: colors.accent,
    colorText: colors.ink,
    fontFamily: fonts.body,
    borderRadius: '16px',
  },
  elements: {
    rootBox: { width: '100%', maxWidth: 'none' },
    formButtonPrimary: { minHeight: '44px' },
    socialButtonsBlockButton: { minHeight: '44px' },
    formFieldInput: { minHeight: '44px' },
    cardBox: { width: '100%', maxWidth: 'none', boxShadow: 'none' },
    card: { width: '100%', maxWidth: 'none', boxShadow: 'none', border: '1px solid #E2E5DC' },
  },
};

export function ClerkLogin({ mode = 'sign-in' }: { mode?: 'sign-in' | 'sign-up' }) {
  return mode === 'sign-up' ? (
    <SignUp routing="hash" signInUrl="/sign-in" forceRedirectUrl="/" appearance={appearance} />
  ) : (
    <SignIn
      routing="hash"
      signUpUrl="/sign-in?mode=sign-up"
      forceRedirectUrl="/"
      appearance={appearance}
    />
  );
}
