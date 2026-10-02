import { Redirect } from 'expo-router';

/**
 * Deep-link target for Apple/Google sign-in (footballmillionaire://auth/callback).
 * The browser session in features/auth/oauth.ts consumes the code; if the OS
 * opens the app via the link instead, just go home.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
