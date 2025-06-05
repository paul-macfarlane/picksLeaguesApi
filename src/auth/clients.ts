import * as client from 'openid-client';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  issuerUrl: string;
  callbackUrl: string;
}

const googleConfig: OAuthConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  issuerUrl: 'https://accounts.google.com',
  callbackUrl: `${process.env.BASE_URL}/auth/callback/google`,
};

const discordConfig: OAuthConfig = {
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  issuerUrl: 'https://discord.com',
  callbackUrl: `${process.env.BASE_URL}/auth/callback/discord`,
};

export async function createClients() {
  // Configure Google client
  const googleConfig = await client.discovery(
    new URL('https://accounts.google.com'),
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!
  );

  // Configure Discord client
  const discordConfig = await client.discovery(
    new URL('https://discord.com/.well-known/openid-configuration'),
    process.env.DISCORD_CLIENT_ID!,
    process.env.DISCORD_CLIENT_SECRET!
  );

  return {
    google: googleConfig,
    discord: discordConfig,
  };
}

export type OAuthClients = Awaited<ReturnType<typeof createClients>>;
