# OAuth Implementation Documentation

## Overview

This document describes the OAuth 2.0 + OpenID Connect implementation in the Picks League API. The system supports authentication with multiple providers (Google and Discord) using the `openid-client` library and implements the Authorization Code flow with PKCE for enhanced security.

## Technical Stack

- **OAuth Library**: `openid-client`
- **JWT**: `jsonwebtoken` for session management
- **Database**: PostgreSQL with Drizzle ORM
- **Framework**: Express.js with TypeScript

## Security Features

1. **PKCE (Proof Key for Code Exchange)**

   - Prevents authorization code interception attacks
   - Generates a unique code verifier and challenge for each auth request
   - Required for public clients, but we use it for all flows for consistency

2. **State Parameter**

   - Prevents CSRF attacks
   - Unique for each auth request
   - Validated on callback

3. **Token-based Authentication**
   - Access tokens (JWT)
     - Short-lived (1 hour)
     - Contains user ID and provider info
     - Used for API requests
   - Refresh tokens
     - Long-lived (30 days)
     - Stored securely in database
     - Can be revoked
     - Used to obtain new access tokens

## Database Schema

### Users Table

```typescript
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  providerId: text("provider_id").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### Refresh Tokens Table

```typescript
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isRevoked: boolean("is_revoked").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

## Authentication Flow

### 1. Login Initiation (`/auth/login/:provider`)

```typescript
// 1. Generate PKCE values
const codeVerifier = client.randomPKCECodeVerifier();
const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
const state = client.randomState();

// 2. Store for callback verification
states.set(state, { codeVerifier, state, provider });

// 3. Build authorization URL with parameters
const parameters = {
  redirect_uri: `${process.env.BASE_URL}/auth/callback/${provider}`,
  scope: "openid email profile",
  code_challenge: codeChallenge,
  code_challenge_method: "S256",
  state,
};
```

### 2. Provider Callback (`/auth/callback/:provider`)

```typescript
// 1. Exchange code for tokens using PKCE
const tokens = await client.authorizationCodeGrant(config, currentUrl, {
  pkceCodeVerifier: storedState.codeVerifier,
  expectedState: storedState.state,
});

// 2. Fetch user info
const userInfoResponse = await client.fetchProtectedResource(
  config,
  tokens.access_token,
  new URL(config.serverMetadata().userinfo_endpoint!),
  "GET",
);

// 3. Create or update user
// 4. Generate tokens
const tokens = await tokenService.generateTokens(userId, provider);
// Returns: { accessToken, refreshToken, expiresIn }
```

## Environment Variables

Required environment variables:

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
JWT_SECRET=your_jwt_secret
BASE_URL=http://localhost:3000  # Your application's base URL
```

## Provider Setup

### Google

1. Go to Google Cloud Console
2. Create a new project or select existing one
3. Enable OAuth 2.0 API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/auth/callback/google` (development)
   - `https://your-domain.com/auth/callback/google` (production)

### Discord

1. Go to Discord Developer Portal
2. Create a new application
3. Go to OAuth2 settings
4. Add redirect URIs:
   - `http://localhost:3000/auth/callback/discord` (development)
   - `https://your-domain.com/auth/callback/discord` (production)

## Security Considerations

1. Always use HTTPS in production
2. Keep JWT_SECRET secure and complex
3. Consider using Redis for state storage in production
4. Regularly rotate JWT_SECRET
5. Implement rate limiting for auth endpoints
6. Monitor for suspicious authentication patterns

## Session & Token Management

### Refresh Token Flow

```typescript
// Request new access token
POST /auth/refresh
Body: { refreshToken: string }
Response: { accessToken: string, expiresIn: number }

// Revoke refresh token
POST /auth/revoke
Body: { refreshToken: string }
Response: { message: string }
```

### Security Features

- Refresh tokens are stored in a database and can be revoked
- Automatic cleanup of expired and revoked tokens
- One refresh token per user per device
- Access tokens are short-lived (1 hour)
- Refresh tokens expire after 30 days
- Sessions expire after 24 hours of inactivity
- Sessions are automatically extended when accessed
- Sessions can be revoked individually or all at once
- Session data is stored securely in PostgreSQL

### Session Management

```typescript
// Get current session info
GET / auth / session;
Response: {
  id: string;
  userId: string;
  data: {
    provider: string;
    email: string;
    name: string;
    lastLogin: string;
  }
  expiresAt: string;
}

// End current session
DELETE / auth / session;
Response: {
  message: string;
}

// End all sessions for current user
DELETE / auth / sessions;
Response: {
  message: string;
}
```

### Session Features

- Automatic session creation on login
- Session data includes user info and last login
- Sessions are extended automatically when close to expiry
- Sessions can be terminated individually or all at once
- Session middleware attaches session to request object
- Session ID is passed via `x-session-id` header

## Future Improvements

1. Add more providers (GitHub, Microsoft, etc.)
2. Add role-based access control
3. Add session analytics and monitoring

## Troubleshooting

1. **Invalid State Error**: Usually means the auth flow was interrupted or timed out
2. **Provider Configuration Error**: Check environment variables and provider setup
3. **PKCE Errors**: Ensure code verifier is properly stored and transmitted
4. **JWT Errors**: Verify JWT_SECRET is properly set

## Resources

- [OpenID Client Documentation](https://github.com/panva/openid-client)
- [OAuth 2.0 Security Best Practices](https://oauth.net/2/security-best-practices/)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Discord OAuth 2.0 Documentation](https://discord.com/developers/docs/topics/oauth2)
