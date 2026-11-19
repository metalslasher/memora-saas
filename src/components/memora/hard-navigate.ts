/**
 * Full page load instead of client navigation. Used only when the auth state
 * changes (sign in/out, email links): it drops the client router cache, so no
 * page rendered for the previous session can be restored with Back.
 */
export function hardNavigate(path: string) {
  window.location.assign(path);
}
