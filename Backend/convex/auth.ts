import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import {
  resolveRedirect,
  validateRedirectOrThrow,
} from "./lib/redirectPolicy";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/drive",
          access_type: "offline",
          prompt: "consent",
        },
      },
      profile(profile, tokens) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token,
          googleTokenExpiresAt: tokens.expires_at,
        };
      },
    }),
  ],
  callbacks: {
    async redirect({ redirectTo }) {
      const siteUrl = process.env.SITE_URL;
      if (!siteUrl) {
        throw new Error("SITE_URL not configured");
      }

      const resolvedRedirect = resolveRedirect(redirectTo, siteUrl);
      validateRedirectOrThrow(resolvedRedirect);
      return resolvedRedirect.toString();
    },

    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      const googleAccessToken = profile.googleAccessToken as string | undefined;
      const googleRefreshToken = profile.googleRefreshToken as string | undefined;
      const googleTokenExpiresAt = profile.googleTokenExpiresAt as number | undefined;

      if (existingUserId) {
        if (googleAccessToken) {
          await ctx.db.patch(existingUserId, {
            googleAccessToken,
            googleRefreshToken: googleRefreshToken ?? undefined,
            googleTokenExpiresAt: googleTokenExpiresAt
              ? googleTokenExpiresAt * 1000
              : undefined,
          });
        }
        return existingUserId;
      }

      return await ctx.db.insert("users", {
        name: profile.name as string | undefined,
        email: profile.email as string | undefined,
        image: profile.image as string | undefined,
        emailVerificationTime: Date.now(),
        googleAccessToken,
        googleRefreshToken: googleRefreshToken ?? undefined,
        googleTokenExpiresAt: googleTokenExpiresAt
          ? googleTokenExpiresAt * 1000
          : undefined,
      });
    },
  },
});
