import { Router } from "express";
import * as client from "openid-client";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, type NewUser } from "../db/schema";
import { tokenService } from "./token-service";
import { sessionService } from "./session-service";
export interface OAuthClients {
  google: client.Configuration;
  discord: client.Configuration;
}

export function createAuthRouter(clients: OAuthClients) {
  const router = Router();

  // Store PKCE and state in memory (consider using Redis in production)
  const states = new Map<
    string,
    { codeVerifier: string; state: string; provider: string }
  >();

  router.get("/login/:provider", async (req, res) => {
    const { provider } = req.params;
    const config = clients[provider as keyof OAuthClients];

    if (!config) {
      return res.status(400).json({ error: "Invalid provider" });
    }

    // Generate PKCE and state
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();

    // Store for validation in callback
    states.set(state, { codeVerifier, state, provider });

    const parameters: Record<string, string> = {
      redirect_uri: `${process.env.BASE_URL}/auth/callback/${provider}`,
      scope: provider === "discord" ? "identify email" : "openid email profile",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
    };

    const redirectTo = client.buildAuthorizationUrl(config, parameters);
    res.redirect(redirectTo.href);
  });

  router.get("/callback/:provider", async (req, res) => {
    const { provider } = req.params;
    const config = clients[provider as keyof OAuthClients];

    if (!config) {
      return res.status(400).json({ error: "Invalid provider" });
    }

    const currentUrl = new URL(
      req.originalUrl || "",
      process.env.BASE_URL || `http://${req.headers.host}`,
    );
    const storedState = states.get(req.query.state as string);

    if (!storedState || storedState.provider !== provider) {
      return res.status(400).json({ error: "Invalid state" });
    }

    try {
      const authTokens = await client.authorizationCodeGrant(
        config,
        currentUrl,
        {
          pkceCodeVerifier: storedState.codeVerifier,
          expectedState: storedState.state,
        },
      );

      // Fetch user info using access token
      let userInfoJson: { email: string; name: string; sub: string };

      if (provider === "discord") {
        const userInfoResponse = await fetch(
          "https://discord.com/api/users/@me",
          {
            headers: {
              Authorization: `Bearer ${authTokens.access_token}`,
            },
          },
        );

        if (!userInfoResponse.ok) {
          throw new Error(`Discord API error: ${userInfoResponse.status}`);
        }

        const responseBody = await userInfoResponse.text();

        const discordUser = JSON.parse(responseBody) as {
          id: string;
          email: string;
          username: string;
          discriminator: string;
        };

        userInfoJson = {
          email: discordUser.email,
          name: discordUser.username,
          sub: discordUser.id,
        };
      } else {
        const userInfoResponse = await client.fetchProtectedResource(
          config,
          authTokens.access_token,
          new URL(config.serverMetadata().userinfo_endpoint!),
          "GET",
        );

        if (!userInfoResponse.body) {
          throw new Error("Failed to fetch user info");
        }

        userInfoJson = JSON.parse(userInfoResponse.body.toString()) as {
          email: string;
          name: string;
          sub: string;
        };
      }

      // Find or create user
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.providerId, userInfoJson.sub))
        .execute();

      let userId: string;

      if (existingUser.length === 0) {
        const newUser: NewUser = {
          provider,
          providerId: userInfoJson.sub,
          email: userInfoJson.email,
          name: userInfoJson.name,
        };

        const [user] = await db
          .insert(users)
          .values(newUser)
          .returning({ id: users.id });
        userId = user.id;
      } else {
        userId = existingUser[0].id;
      }

      // Generate tokens
      const tokens = await tokenService.generateTokens(userId, provider);

      // Create session
      const session = await sessionService.createSession(userId, {
        provider,
        email: userInfoJson.email,
        name: userInfoJson.name,
        lastLogin: new Date(),
      });

      res.json({
        ...tokens,
        sessionId: session.id,
      });
    } catch (err) {
      console.error("Authentication error:", err);
      res.status(500).json({ error: "Authentication failed" });
    } finally {
      states.delete(storedState.state);
    }
  });

  // Refresh token endpoint
  router.post("/refresh", async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    try {
      const tokens = await tokenService.refreshAccessToken(refreshToken);
      res.json(tokens);
    } catch (err) {
      console.error("Token refresh error:", err);
      res.status(401).json({ error: "Invalid refresh token" });
    }
  });

  // Revoke refresh token endpoint
  router.post("/revoke", async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    try {
      await tokenService.revokeRefreshToken(refreshToken);
      res.json({ message: "Token revoked successfully" });
    } catch (err) {
      console.error("Token revocation error:", err);
      res.status(500).json({ error: "Failed to revoke token" });
    }
  });

  // Session management routes
  router.get("/session", async (req, res) => {
    if (!req.session) {
      return res.status(401).json({ error: "No active session" });
    }

    res.json(req.session);
  });

  router.delete("/session", async (req, res) => {
    if (!req.session) {
      return res.status(401).json({ error: "No active session" });
    }

    await sessionService.deleteSession(req.session.id);
    res.json({ message: "Session terminated" });
  });

  router.delete("/sessions", async (req, res) => {
    if (!req.session) {
      return res.status(401).json({ error: "No active session" });
    }

    await sessionService.deleteUserSessions(req.session.userId);
    res.json({ message: "All sessions terminated" });
  });

  return router;
}

export type AuthRouter = ReturnType<typeof createAuthRouter>;
