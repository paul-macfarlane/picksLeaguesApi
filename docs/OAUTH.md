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

3. **JWT for Sessions**
   - Signed with a secret key
   - Contains user ID and provider info
   - 7-day expiration

## Database Schema
```typescript
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  provider: text('provider').notNull(),
  providerId: text('provider_id').notNull(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
  "GET"
);

// 3. Create or update user
// 4. Generate JWT
const token = jwt.sign({ userId, provider }, process.env.JWT_SECRET!, {
  expiresIn: "7d",
});
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

## Future Improvements
1. Add refresh token support
2. Implement token revocation
3. Add more providers (GitHub, Microsoft, etc.)
4. Add role-based access control
5. Implement session management
6. Add OAuth2.0 token introspection

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
