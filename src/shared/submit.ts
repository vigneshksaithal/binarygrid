/**
 * Error code /api/submit returns for logged-out players, so the client can
 * offer a login instead of retrying a solve the server will never save.
 */
export const LOGIN_REQUIRED_CODE = 'login_required'
