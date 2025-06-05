import { Request, Response, NextFunction } from 'express';
import { sessionService } from './session-service';

declare global {
  namespace Express {
    interface Request {
      session?: {
        id: string;
        userId: string;
        data: Record<string, any>;
        expiresAt: Date;
      };
    }
  }
}

export const sessionMiddleware = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const sessionId = req.headers['x-session-id'] as string;

    if (!sessionId) {
      return next();
    }

    try {
      const session = await sessionService.getSession(sessionId);
      
      if (session) {
        req.session = {
          id: session.id,
          userId: session.userId,
          data: session.data as Record<string, any>,
          expiresAt: session.expiresAt,
        };

        // Extend session if it's close to expiring (optional)
        const now = new Date();
        const timeUntilExpiry = session.expiresAt.getTime() - now.getTime();
        if (timeUntilExpiry < 1000 * 60 * 60) { // Less than 1 hour left
          await sessionService.extendSession(sessionId);
        }
      }
    } catch (error) {
      console.error('Session middleware error:', error);
    }

    next();
  };
};
