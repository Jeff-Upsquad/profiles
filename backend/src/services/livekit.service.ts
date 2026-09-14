import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

export function isSquadUpConfigured(): boolean {
  return Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
}

function requireConfig() {
  if (!isSquadUpConfigured()) {
    throw new AppError(503, 'SquadUp is not configured on this server.');
  }
  return {
    url: env.LIVEKIT_URL!,
    key: env.LIVEKIT_API_KEY!,
    secret: env.LIVEKIT_API_SECRET!,
  };
}

export async function mintSquadUpToken(input: {
  roomName: string;
  identity: string;
  name: string;
  metadata?: Record<string, unknown>;
}) {
  const config = requireConfig();
  const token = new AccessToken(config.key, config.secret, {
    identity: input.identity,
    name: input.name,
    metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
    ttl: '6h',
  });
  token.addGrant({
    room: input.roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return { token: await token.toJwt(), url: config.url };
}

export async function closeSquadUpRoom(roomName: string): Promise<void> {
  if (!isSquadUpConfigured()) return;
  const config = requireConfig();
  const restUrl = config.url.replace(/^ws(s?):\/\//, 'http$1://');
  try {
    await new RoomServiceClient(restUrl, config.key, config.secret).deleteRoom(roomName);
  } catch (error: any) {
    if (error?.status === 404 || /not found/i.test(String(error?.message))) return;
    console.error('[group-meet] failed to close SquadUp room', error?.message || error);
  }
}
