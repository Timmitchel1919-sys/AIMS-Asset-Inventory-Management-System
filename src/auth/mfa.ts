import {
  EmailAuthProvider,
  multiFactor,
  reauthenticateWithCredential,
  TotpMultiFactorGenerator,
  type MultiFactorInfo,
  type TotpSecret,
} from "firebase/auth";
import { requireFirebase } from "../lib/firebase";

export type MfaStatus = {
  enrolled: boolean;
  factors: Array<{ uid: string; displayName: string; factorId: string }>;
};

export function describeMfaStatus(info: MultiFactorInfo[]): MfaStatus {
  return {
    enrolled: info.length > 0,
    factors: info.map((factor) => ({
      uid: factor.uid,
      displayName: factor.displayName ?? "Authenticator",
      factorId: factor.factorId,
    })),
  };
}

export function getMfaStatus(): MfaStatus {
  const user = requireFirebase().auth.currentUser;
  if (!user) return { enrolled: false, factors: [] };
  return describeMfaStatus(multiFactor(user).enrolledFactors);
}

export type TotpEnrollmentStart = {
  secret: TotpSecret;
  secretKey: string;
  qrCodeUrl: string;
};

/**
 * Begin TOTP enrollment. Caller shows `qrCodeUrl` as a scannable QR and the
 * user types the 6-digit code into an input, which is then passed to
 * `finalizeTotpEnrollment` together with the returned `secret`.
 */
export async function startTotpEnrollment(
  issuer: string,
  accountName: string,
): Promise<TotpEnrollmentStart> {
  const user = requireFirebase().auth.currentUser;
  if (!user) throw new Error("Sign in to configure MFA.");
  const session = await multiFactor(user).getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  const qrCodeUrl = secret.generateQrCodeUrl(accountName, issuer);
  return { secret, secretKey: secret.secretKey, qrCodeUrl };
}

export async function finalizeTotpEnrollment(
  secret: TotpSecret,
  verificationCode: string,
  displayName = "Authenticator app",
): Promise<void> {
  const user = requireFirebase().auth.currentUser;
  if (!user) throw new Error("Sign in to configure MFA.");
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
    secret,
    verificationCode.trim(),
  );
  await multiFactor(user).enroll(assertion, displayName);
}

export async function disableMfaFactor(
  factorUid: string,
  currentPassword: string,
): Promise<void> {
  const user = requireFirebase().auth.currentUser;
  if (!user || !user.email) throw new Error("Sign in to disable MFA.");
  await reauthenticateWithCredential(
    user,
    EmailAuthProvider.credential(user.email, currentPassword),
  );
  await multiFactor(user).unenroll(factorUid);
}
