/**
 * The pending authorization request travels from /oauth/authorize to the
 * web app's consent screen and back as a short-lived signed JWT, so the API
 * keeps no server-side state until the user actually approves.
 */

import { signJwt, verifyJwt } from "../jwt.js";
import { CONSENT_REQUEST_TTL_SECONDS } from "./config.js";

const AUDIENCE = "open-sunsama:oauth-consent";

export interface ConsentRequest {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource: string | null;
  state: string | null;
}

export function signConsentRequest(request: ConsentRequest): string {
  return signJwt(
    { req: request },
    {
      audience: AUDIENCE,
      expiresIn: CONSENT_REQUEST_TTL_SECONDS,
    }
  );
}

export function verifyConsentRequest(token: string): ConsentRequest | null {
  try {
    const decoded = verifyJwt(token, { audience: AUDIENCE }) as {
      req?: ConsentRequest;
    };
    return decoded.req ?? null;
  } catch {
    return null;
  }
}
