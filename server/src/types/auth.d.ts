// Defines the shape of the JWT payload and the user object attached to the request

export interface AuthPayload {
  id: string;
  role?: string;
  deviceId?: string;
  jti?: string; // JWT ID — used for Redis blacklist checks
}

export type AuthJwtPayload = AuthPayload;
