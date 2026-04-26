import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import OnboardingForm from './onboarding-form';

export const metadata: Metadata = {
  title: 'Configurá tu hogar — Mi Despensa Familiar',
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Defense in depth: skip onboarding if the user already has a household.
  const { data: existingMembership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (existingMembership) {
    redirect('/');
  }

  return <OnboardingForm />;
}
