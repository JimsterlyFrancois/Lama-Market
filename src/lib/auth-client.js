import { createAuthClient } from "@neon/auth";
import { BetterAuthReactAdapter } from "@neon/auth/react/adapters";

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;

export const authClient = authUrl
  ? createAuthClient(authUrl, { adapter: BetterAuthReactAdapter() })
  : null;

export async function getAccessToken() {
  if (!authClient) throw new Error("L'authentification Neon n'est pas configurée.");
  const { data, error } = await authClient.token();
  if (error || !data?.token) throw new Error(error?.message || "Session expirée. Reconnectez-vous.");
  return data.token;
}


// Neon Auth exposes its managed email-OTP endpoints through the Better Auth client.
const managedClient = authClient;
export const emailOtp = managedClient ? {
  sendVerificationOtp: (email, type) =>
    managedClient.emailOtp.sendVerificationOtp({ email, type }),
  verifyEmail: (email, otp) =>
    managedClient.emailOtp.verifyEmail({ email, otp }),
  forgetPassword: (email) =>
    managedClient.emailOtp.requestPasswordReset({ email }),
  resetPassword: (email, otp, password) =>
    managedClient.emailOtp.resetPassword({ email, otp, password }),
} : null;
