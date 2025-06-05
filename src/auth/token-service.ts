import { db } from '../db';
import { refreshTokens, users } from '../db/schema';
import type { NewRefreshToken } from '../db/schema';
import { eq, and, lt, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

const REFRESH_TOKEN_EXPIRES_IN = 30 * 24 * 60 * 60; // 30 days in seconds
const ACCESS_TOKEN_EXPIRES_IN = '1h';

interface TokenPayload {
  userId: string;
  provider: string;
}

export class TokenService {
  /**
   * Generate both access and refresh tokens
   */
  async generateTokens(userId: string, provider: string) {
    // Generate access token
    const accessToken = jwt.sign(
      { userId, provider },
      process.env.JWT_SECRET!,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );

    // Generate refresh token
    const refreshToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + REFRESH_TOKEN_EXPIRES_IN);

    // Store refresh token
    const newRefreshToken: NewRefreshToken = {
      userId,
      token: refreshToken,
      expiresAt,
    };

    await db.insert(refreshTokens).values(newRefreshToken);

    return {
      accessToken,
      refreshToken,
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    };
  }

  /**
   * Refresh an access token using a refresh token
   */
  async refreshAccessToken(refreshToken: string) {
    // Find valid refresh token
    const [token] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.token, refreshToken),
          eq(refreshTokens.isRevoked, false),
          lt(refreshTokens.expiresAt, new Date())
        )
      )
      .execute();

    if (!token) {
      throw new Error('Invalid refresh token');
    }

    // Get user info
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, token.userId))
      .execute();

    if (!user) {
      throw new Error('User not found');
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { userId: user.id, provider: user.provider },
      process.env.JWT_SECRET!,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );

    return {
      accessToken,
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    };
  }

  /**
   * Revoke a refresh token
   */
  async revokeRefreshToken(refreshToken: string) {
    await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.token, refreshToken))
      .execute();
  }

  /**
   * Clean up expired refresh tokens
   */
  async cleanupExpiredTokens() {
    await db
      .delete(refreshTokens)
      .where(
        or(
          lt(refreshTokens.expiresAt, new Date()),
          eq(refreshTokens.isRevoked, true)
        )
      )
      .execute();
  }
}

export const tokenService = new TokenService();
