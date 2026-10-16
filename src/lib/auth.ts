import { createClient } from '@/lib/supabase/server';
import { Profile } from '@/types/database';

export async function getCurrentProfile(): Promise<Profile | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*, school:schools(*)')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      return null;
    }

    return profile as Profile;
  } catch (err) {
    console.error('Error fetching profile:', err);
    return null;
  }
}
