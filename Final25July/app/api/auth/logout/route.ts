import { apiSuccess } from "@/lib/api-utils/response";
import { withErrorHandling } from "@/lib/api-utils/errors";
import { SESSION_COOKIE } from "@/lib/auth/session";

export const POST = withErrorHandling(async () => {
  const response = apiSuccess({ signedOut: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
});
