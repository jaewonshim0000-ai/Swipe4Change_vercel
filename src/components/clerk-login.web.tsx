import { SignIn } from '@clerk/expo/web';
export function ClerkLogin() {
  return <SignIn routing="hash" forceRedirectUrl="/" />;
}
