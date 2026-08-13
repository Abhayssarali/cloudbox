import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { prisma } from "./prisma.js";

const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] || "dummy-client-id";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] || "dummy-client-secret";
const GOOGLE_CALLBACK_URL =
  process.env["GOOGLE_CALLBACK_URL"] || "http://localhost:4000/auth/google/callback";

// Sentinel type for new Google users who haven't chosen a workspace yet
export interface GooglePendingUser {
  googlePending: true;
  id: "pending";
  googleId: string;
  email: string;
  displayName: string;
}

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error("No email returned from Google"));
        }

        // Check if user already exists (by googleId OR email)
        const existing = await prisma.user.findFirst({
          where: {
            OR: [{ googleId: profile.id }, { email }],
          },
        });

        if (existing) {
          // Existing user: link their Google account if not already linked, then log in
          if (!existing.googleId) {
            const updated = await prisma.user.update({
              where: { id: existing.id },
              data: { googleId: profile.id },
            });
            return done(null, updated);
          }
          return done(null, existing);
        }

        // New Google user — don't create them yet.
        // Return a pending sentinel so the callback route can redirect them
        // to the workspace-setup page before creating their account.
        const pending: GooglePendingUser = {
          googlePending: true,
          id: "pending",
          googleId: profile.id,
          email,
          displayName: profile.displayName ?? email,
        };
        return done(null, pending as unknown as Express.User);
      } catch (err) {
        return done(err instanceof Error ? err : new Error(String(err)));
      }
    }
  )
);

// Minimal serialization — we don't use sessions beyond the OAuth state handshake
passport.serializeUser((user: Express.User, done) => {
  done(null, (user as { id: string }).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err);
  }
});

export { passport };
