import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
const firebaseKeys = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);
export type VerifiedIdentity = { uid: string; email?: string; emailVerified: boolean };
export async function verifyFirebaseIdentity(
  token: string,
  projectId: string,
  keys: JWTVerifyGetKey = firebaseKeys,
): Promise<VerifiedIdentity> {
  const { payload } = await jwtVerify(token, keys, {
    algorithms: ["RS256"],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
    requiredClaims: ["exp", "iat", "sub", "auth_time"],
  });
  const now = Date.now() / 1000;
  if (
    !payload.sub ||
    payload.sub.length > 128 ||
    typeof payload.auth_time !== "number" ||
    payload.auth_time > now ||
    typeof payload.iat !== "number" ||
    payload.iat > now
  )
    throw new Error("Invalid identity");
  const firebase = payload.firebase as
    { sign_in_provider?: string } | undefined;
  if (firebase?.sign_in_provider !== "google.com")
    throw new Error("Google sign-in required");
  return { uid: payload.sub, email: typeof payload.email === "string" ? payload.email : undefined, emailVerified: payload.email_verified === true };
}

export async function verifyFirebaseToken(token: string, projectId: string, keys: JWTVerifyGetKey = firebaseKeys): Promise<string> {
  return (await verifyFirebaseIdentity(token, projectId, keys)).uid;
}
