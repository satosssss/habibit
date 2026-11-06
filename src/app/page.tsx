import { redirect } from 'next/navigation';

/** Accounts spec D2: Home moved to /home so / can stay a stable redirect. */
export default function RootPage() {
  redirect('/home');
}
