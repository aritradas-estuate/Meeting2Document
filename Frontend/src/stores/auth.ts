import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";

export function useAuthStore() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const convexUser = useQuery(api.users.getCurrentUser);

  const user = convexUser ? {
    id: convexUser._id,
    email: convexUser.email ?? "",
    name: convexUser.name ?? "User",
    picture_url: convexUser.image ?? null,
    created_at: new Date(convexUser._creationTime).toISOString(),
    updated_at: new Date(convexUser._creationTime).toISOString(),
  } : null;

  return {
    user,
    convexUser,
    isAuthenticated,
    isLoading: isLoading || (isAuthenticated && convexUser === undefined),
    isUserReady: isAuthenticated && !!convexUser,
    error: null,
    signIn: () => signIn("google"),
    logout: () => signOut(),
    checkAuth: () => {},
  };
}

export function useIsAuthenticated() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  return { isAuthenticated, isLoading };
}
