import { db } from '../db';
import { sessions, type NewSession } from '../db/schema';
import { eq, lt, and, gt } from 'drizzle-orm';

const SESSION_DURATION = 24 * 60 * 60; // 24 hours in seconds

export class SessionService {
  /**
   * Create a new session for a user
   */
  async createSession(userId: string, data: Record<string, any> = {}) {
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + SESSION_DURATION);

    const [session] = await db
      .insert(sessions)
      .values({
        userId,
        data,
        expiresAt,
      })
      .returning();

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string) {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .execute();

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    // Update last accessed time
    await db
      .update(sessions)
      .set({ lastAccessedAt: new Date() })
      .where(eq(sessions.id, sessionId))
      .execute();

    return session;
  }

  /**
   * Update session data
   */
  async updateSession(sessionId: string, data: Record<string, any>) {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .execute();

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    const updatedSession = await db
      .update(sessions)
      .set({
        data: { ...(session.data as Record<string, any>), ...data },
        lastAccessedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId))
      .returning()
      .execute();

    return updatedSession[0];
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string) {
    await db
      .delete(sessions)
      .where(eq(sessions.id, sessionId))
      .execute();
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: string) {
    await db
      .delete(sessions)
      .where(eq(sessions.userId, userId))
      .execute();
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    await db
      .delete(sessions)
      .where(lt(sessions.expiresAt, new Date()))
      .execute();
  }

  /**
   * Extend session expiration
   */
  async extendSession(sessionId: string) {
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + SESSION_DURATION);

    const [session] = await db
      .update(sessions)
      .set({
        expiresAt,
        lastAccessedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId))
      .returning()
      .execute();

    return session;
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string) {
    const now = new Date();
    return db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          gt(sessions.expiresAt, now)
        )
      )
      .execute();
  }
}

export const sessionService = new SessionService();
