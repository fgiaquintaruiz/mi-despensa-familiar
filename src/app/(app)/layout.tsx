import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from './_components/AppHeader';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect('/onboarding');
  }

  return (
    <div className="relative mx-auto max-w-[480px] px-5 pt-8">
      <AppHeader />
      {children}
    </div>
  );
}
