import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

// undefined  = role not fetched yet (fetch in flight)
// null       = fetched but user has no entry in user_roles
// "coach" | "student" = fetched, role known
type UserRole = "coach" | "student" | null | undefined;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, role: undefined, loading: true, signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(undefined);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    setRole((data?.role as "coach" | "student") ?? null);
    setLoading(false);
  };

  useEffect(() => {
    // Track which user the current role belongs to, so background token
    // refreshes for the same user don't re-trigger the loading spinner.
    let currentUserId: string | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Always keep the session/user references fresh (refreshed tokens, etc.)
        setSession(session);
        setUser(session?.user ?? null);

        const newUserId = session?.user?.id ?? null;

        // TOKEN_REFRESHED / USER_UPDATED fire periodically while the app is open
        // (Supabase auto-refreshes the access token, and again when a tab regains
        // focus). These are NOT logins/logouts — the role hasn't changed. Resetting
        // role to undefined here would flip ProtectedRoutes into its loading state,
        // unmounting the active page (e.g. Kiosk mode) and wiping in-progress work.
        // So for the same user we update the session silently and return early.
        if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          currentUserId = newUserId;
          return;
        }

        if (session?.user) {
          // Only show the spinner + refetch the role when the user actually changes.
          if (newUserId !== currentUserId) {
            currentUserId = newUserId;
            setRole(undefined);
            setTimeout(() => fetchRole(session.user.id), 0);
          }
        } else {
          currentUserId = null;
          setRole(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        currentUserId = session.user.id;
        fetchRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
