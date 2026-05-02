import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { Profile } from "../types";
import { getProfile, createProfile } from "../lib/db";

interface UseAuthResult {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (
    email: string,
    password: string,
    username: string,
  ) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety timeout — if Supabase never responds, stop showing the loading screen
    const timeout = setTimeout(() => {
      console.error(
        "Supabase getSession timed out. Check your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env",
      );
      setLoading(false);
    }, 5000);

    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        clearTimeout(timeout);
        console.log("getSession result:", session, error);
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          getProfile(session.user.id).then(setProfile);
        }
        setLoading(false);
      })
      .catch((err) => {
        clearTimeout(timeout);
        console.error("getSession threw:", err);
        setLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const p = await getProfile(session.user.id);
        setProfile(p);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (
    email: string,
    password: string,
  ): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return error ? error.message : null;
  };

  const signUp = async (
    email: string,
    password: string,
    username: string,
  ): Promise<string | null> => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
    if (data.user) {
      const p = await createProfile(data.user.id, username);
      if (!p)
        return "Account created but failed to save username. Please sign in.";
    }
    return null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, profile, session, loading, signIn, signUp, signOut };
}
