import { redirect } from 'next/navigation';

// The S0 token proof sheet lived here. It has served its purpose: from S1 the
// root is just a door into the app, and the middleware decides whether it opens
// onto the dashboard or onto sign-in.
export default function RootPage() {
  redirect('/dashboard');
}
