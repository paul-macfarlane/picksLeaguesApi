import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createClients } from './auth/clients';
import { createAuthRouter } from './auth/routes';

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  // Initialize OAuth clients
  const clients = await createClients();

  // Set up auth routes
  app.use('/auth', createAuthRouter(clients));

  app.get('/', (_req: Request, res: Response) => {
    res.json({ message: 'Welcome to Picks League API' });
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
