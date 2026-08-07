import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { prisma } from "./prisma.js";

const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] || "dummy-client-id";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] || "dummy-client-secret";
const GOOGLE_CALLBACK_URL =
  process.env["GOOGLE_CALLBACK_URL"] || "http://localhost:4000/auth/google/callback";

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

        // Find existing user by googleId or email, or create new one
        let user = await prisma.user.findFirst({
          where: {
            OR: [{ googleId: profile.id }, { email }],
          },
        });

        if (!user) {
          // New user — create account
          user = await prisma.user.create({
            data: {
              email,
              googleId: profile.id,
              role: "USER",
            },
          });
        } else if (!user.googleId) {
          // Existing email/password user — link Google account
          user = await prisma.user.update({
            where: { id: user.id },
            data: { googleId: profile.id },
          });
        }

        return done(null, user);
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
