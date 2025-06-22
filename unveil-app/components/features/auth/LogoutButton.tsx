'use client';

import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <button
      onClick={handleLogout}
      className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
    >
      Log Out
    </button>
  );
}
