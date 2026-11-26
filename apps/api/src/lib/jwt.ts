/**
 * JWT utilities for Open Sunsama API
 * Handles token signing and verification
 */

import jwt from "jsonwebtoken";
import type {
  JwtPayload as JwtClaims,
  Secret,
  SignOptions,
  VerifyOptions,
} from "jsonwebtoken";

const JWT_SECRET: Secret =
  process.env.JWT_SECRET || "open-sunsama-dev-secret-change-in-production";
/**
 * Rotates JWT_SECRET without signing anyone out: new tokens are signed with
 * JWT_SECRET_NEXT, and tokens signed with JWT_SECRET keep verifying. Once the
 * last JWT_SECRET token can no longer be refreshed (JWT_EXPIRES_IN plus
 * JWT_REFRESH_LEEWAY_DAYS), move this value into JWT_SECRET and unset it.
 */
const JWT_SECRET_NEXT = process.env.JWT_SECRET_NEXT || undefined;
const SIGNING_SECRET: Secret = JWT_SECRET_NEXT ?? JWT_SECRET;
const VERIFYING_SECRETS: Secret[] = JWT_SECRET_NEXT
  ? [JWT_SECRET_NEXT, JWT_SECRET]
  : [JWT_SECRET];
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * How long after an access token expires it can still be exchanged for a
 * fresh one via the refresh endpoint. This is the "sliding session" window:
 * a user who returns within this grace period after their token lapsed (e.g.
 * the app was closed for a while) is re-issued a token instead of being
 * forced to log in again. Active users (who refresh before expiry) stay
 * logged in indefinitely. Defaults to 30 days.
 */
const PARSED_LEEWAY_DAYS = Number(process.env.JWT_REFRESH_LEEWAY_DAYS);
// Guard against a non-numeric env value (e.g. "30d"): Number("30d") is NaN,
// and `NaN` comparisons are always false, which would silently disable the
// grace-window cap and let arbitrarily-old tokens be refreshed forever.
const JWT_REFRESH_LEEWAY_DAYS = Number.isFinite(PARSED_LEEWAY_DAYS)
  ? Math.max(0, PARSED_LEEWAY_DAYS)
  : 30;
const REFRESH_LEEWAY_SECONDS = JWT_REFRESH_LEEWAY_DAYS * 24 * 60 * 60;

export interface JwtPayload {
  userId: string;
  authTime?: number;
  iat?: number;
  exp?: number;
}

/** Sign any JWT the API issues (sessions, OAuth consent requests). */
export function signJwt(payload: object, options: SignOptions): string {
  return jwt.sign(payload, SIGNING_SECRET, options);
}

/**
 * Verify any JWT the API issued, trying JWT_SECRET_NEXT first, then JWT_SECRET.
 * @throws the verification error (an expired token throws TokenExpiredError)
 */
export function verifyJwt(
  token: string,
  options?: VerifyOptions & { complete?: false }
): string | JwtClaims {
  let lastError: unknown;
  for (const secret of VERIFYING_SECRETS) {
    try {
      return jwt.verify(token, secret, options);
    } catch (error) {
      // Expiry is checked only after the signature matched, so another secret can't help.
      if (
        error instanceof jwt.TokenExpiredError ||
        error instanceof jwt.NotBeforeError
      )
        throw error;
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * Sign a JWT token for a user
 * @param userId - The user ID to include in the token
 * @returns The signed JWT token
 */
export function signToken(
  userId: string,
  authTime: number | undefined = Math.floor(Date.now() / 1000)
): string {
  // Cast to any to bypass strict type checking on expiresIn
  // The string format like '7d' is valid at runtime
  return signJwt({ userId, ...(authTime === undefined ? {} : { authTime }) }, {
    expiresIn: JWT_EXPIRES_IN as string,
  } as SignOptions);
}

/**
 * Verify and decode a JWT token
 * @param token - The JWT token to verify
 * @returns The decoded payload containing userId
 * @throws Error if token is invalid or expired
 */
export function verifyToken(token: string): {
  userId: string;
  authTime?: number;
} {
  const decoded = verifyJwt(token) as JwtPayload;
  return { userId: decoded.userId, authTime: decoded.authTime };
}

/**
 * Verify a token for the purpose of refreshing it.
 *
 * Accepts tokens that are still valid OR that expired within the refresh
 * leeway window (see {@link REFRESH_LEEWAY_SECONDS}). This lets a returning
 * user whose access token lapsed while the app was closed obtain a fresh
 * token instead of being logged out. Tokens that are expired beyond the
 * leeway, have a bad signature, or are otherwise malformed are rejected.
 *
 * @param token - The JWT token to verify
 * @returns The decoded payload containing userId
 * @throws Error if the token cannot be refreshed
 */
export function verifyTokenForRefresh(token: string): {
  userId: string;
  authTime?: number;
} {
  let decoded: JwtPayload;
  try {
    // Fast path: a token that is still within its normal lifetime.
    decoded = verifyJwt(token) as JwtPayload;
  } catch (error) {
    // Only expired tokens are eligible for the grace window. A bad signature
    // or malformed token is never refreshable.
    if (!(error instanceof jwt.TokenExpiredError)) {
      throw error;
    }
    decoded = verifyJwt(token, { ignoreExpiration: true }) as JwtPayload;
    if (typeof decoded.exp !== "number") {
      throw error;
    }
    const expiredForSeconds = Math.floor(Date.now() / 1000) - decoded.exp;
    if (expiredForSeconds > REFRESH_LEEWAY_SECONDS) {
      throw error;
    }
  }

  if (!decoded.userId) {
    throw new Error("Token is missing userId claim");
  }
  return { userId: decoded.userId, authTime: decoded.authTime };
}

/**
 * Decode a JWT token without verification (for debugging)
 * @param token - The JWT token to decode
 * @returns The decoded payload or null if invalid
 */
export function decodeToken(token: string): JwtPayload | null {
  const decoded = jwt.decode(token);
  if (decoded && typeof decoded === "object" && "userId" in decoded) {
    return decoded as JwtPayload;
  }
  return null;
}
