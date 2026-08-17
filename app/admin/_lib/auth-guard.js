import { createServerSupabaseClient } from "../../lib/supabase-server";

// Verifies the request carries a valid Supabase Auth session.
// Returns { user, status }:
//   { user, status: 200 } — valid session
//   { user: null, status: 401 } — no valid Supabase session
//
// Anyone who can sign in (i.e. an account you created in Supabase) is an
// admin; keep public sign-up disabled in your Supabase project so only the
// accounts you create exist.
export async function requireAuthenticatedUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, status: 401 };
  }

  return { user, status: 200 };
}
