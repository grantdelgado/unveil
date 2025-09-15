import { redirect } from 'next/navigation';

/**
 * Minimal root page that immediately redirects to auth flow
 * No providers needed, reducing shared chunk size
 */
export default function RootPage() {
  redirect('/login');
}
