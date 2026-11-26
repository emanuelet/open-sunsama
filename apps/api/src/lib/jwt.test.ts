/**
 * Tests for JWT utilities, focused on the sliding-session refresh logic
 * that keeps users logged in across token expiry.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import jwt from "jsonwebtoken";
import type * as JwtModule from "./jwt.js";

// Pin the secret + leeway BEFORE the module under test is (dynamically)
// imported so it captures these values at evaluation time.
const SECRET = "test-secret-key-for-jwt-tests-min-32-chars";
const NEXT_SECRET = "next-secret-key-for-jwt-rotation-tests-min-32";
process.env.JWT_SECRET = SECRET;
delete process.env.JWT_SECRET_NEXT;
process.env.JWT_REFRESH_LEEWAY_DAYS = "30";

let signToken: typeof JwtModule.signToken;
let verifyToken: typeof JwtModule.verifyToken;
let verifyTokenForRefresh: typeof JwtModule.verifyTokenForRefresh;

beforeAll(async () => {
  const mod = await import("./jwt.js");
  signToken = mod.signToken;
  verifyToken = mod.verifyToken;
  verifyTokenForRefresh = mod.verifyTokenForRefresh;
});

const USER_ID = "11111111-1111-1111-1111-111111111111";
const nowSec = () => Math.floor(Date.now() / 1000);

describe("signToken / verifyToken", () => {
  it("round-trips a userId through a freshly signed token", () => {
    const token = signToken(USER_ID);
    expect(verifyToken(token).userId).toBe(USER_ID);
  });

  it("signs with JWT_SECRET when JWT_SECRET_NEXT is unset", () => {
    const token = signToken(USER_ID);
    expect((jwt.verify(token, SECRET) as { userId: string }).userId).toBe(
      USER_ID
    );
  });

  it("rejects a token signed with another secret", () => {
    const forged = jwt.sign({ userId: USER_ID }, NEXT_SECRET);
    expect(() => verifyToken(forged)).toThrow();
  });

  it("rejects an expired token", () => {
    const expired = jwt.sign({ userId: USER_ID, exp: nowSec() - 60 }, SECRET);
    expect(() => verifyToken(expired)).toThrow();
  });
});

describe("verifyTokenForRefresh", () => {
  it("refreshes a still-valid token", () => {
    const token = signToken(USER_ID);
    expect(verifyTokenForRefresh(token).userId).toBe(USER_ID);
  });

  it("refreshes a token that expired within the grace window", () => {
    // Expired 1 hour ago — well inside the 30-day leeway.
    const recentlyExpired = jwt.sign(
      { userId: USER_ID, exp: nowSec() - 60 * 60 },
      SECRET
    );
    expect(verifyTokenForRefresh(recentlyExpired).userId).toBe(USER_ID);
  });

  it("rejects a token expired beyond the grace window", () => {
    // Expired 40 days ago — past the 30-day leeway.
    const longExpired = jwt.sign(
      { userId: USER_ID, exp: nowSec() - 40 * 24 * 60 * 60 },
      SECRET
    );
    expect(() => verifyTokenForRefresh(longExpired)).toThrow();
  });

  it("rejects a token signed with the wrong secret", () => {
    const forged = jwt.sign({ userId: USER_ID }, "some-other-secret");
    expect(() => verifyTokenForRefresh(forged)).toThrow();
  });

  it("rejects an expired token that has no userId claim", () => {
    const noUser = jwt.sign({ exp: nowSec() - 60 }, SECRET);
    expect(() => verifyTokenForRefresh(noUser)).toThrow();
  });
});

describe("verifyTokenForRefresh — leeway env hardening", () => {
  it("falls back to the default window when JWT_REFRESH_LEEWAY_DAYS is non-numeric (not NaN)", async () => {
    // A garbage value must NOT silently disable the cap (NaN comparisons are
    // always false, which would let arbitrarily-old tokens refresh forever).
    vi.resetModules();
    process.env.JWT_REFRESH_LEEWAY_DAYS = "30d"; // Number("30d") === NaN
    const mod = await import("./jwt.js");
    const ancient = jwt.sign(
      { userId: USER_ID, exp: nowSec() - 365 * 24 * 60 * 60 },
      SECRET
    );
    expect(() => mod.verifyTokenForRefresh(ancient)).toThrow();
    process.env.JWT_REFRESH_LEEWAY_DAYS = "30";
  });
});

describe("rotating JWT_SECRET with JWT_SECRET_NEXT", () => {
  let rotated: typeof JwtModule;

  beforeAll(async () => {
    vi.resetModules();
    process.env.JWT_SECRET_NEXT = NEXT_SECRET;
    rotated = await import("./jwt.js");
    delete process.env.JWT_SECRET_NEXT;
  });

  it("keeps accepting sessions signed with the old secret", () => {
    const oldSession = jwt.sign({ userId: USER_ID }, SECRET, {
      expiresIn: "7d",
    });
    expect(rotated.verifyToken(oldSession).userId).toBe(USER_ID);
    expect(rotated.verifyTokenForRefresh(oldSession).userId).toBe(USER_ID);
  });

  it("signs new sessions with the new secret only", () => {
    const token = rotated.signToken(USER_ID);
    expect((jwt.verify(token, NEXT_SECRET) as { userId: string }).userId).toBe(
      USER_ID
    );
    expect(() => jwt.verify(token, SECRET)).toThrow();
    expect(rotated.verifyToken(token).userId).toBe(USER_ID);
  });

  it("refreshes an old-secret session that expired within the grace window", () => {
    const lapsed = jwt.sign(
      { userId: USER_ID, exp: nowSec() - 60 * 60 },
      SECRET
    );
    expect(() => rotated.verifyToken(lapsed)).toThrow("jwt expired");
    expect(rotated.verifyTokenForRefresh(lapsed).userId).toBe(USER_ID);
  });

  it("refreshes a new-secret session that expired within the grace window", () => {
    const lapsed = jwt.sign(
      { userId: USER_ID, exp: nowSec() - 60 * 60 },
      NEXT_SECRET
    );
    expect(rotated.verifyTokenForRefresh(lapsed).userId).toBe(USER_ID);
  });

  it("rejects an old-secret session expired beyond the grace window", () => {
    const longExpired = jwt.sign(
      { userId: USER_ID, exp: nowSec() - 40 * 24 * 60 * 60 },
      SECRET
    );
    expect(() => rotated.verifyTokenForRefresh(longExpired)).toThrow();
  });

  it("rejects a token signed with neither secret", () => {
    const forged = jwt.sign({ userId: USER_ID }, "some-other-secret");
    expect(() => rotated.verifyToken(forged)).toThrow();
    expect(() => rotated.verifyTokenForRefresh(forged)).toThrow();
  });
});
