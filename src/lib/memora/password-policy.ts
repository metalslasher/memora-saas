export const MIN_PASSWORD_LENGTH = 8;

/**
 * Password policy: at least 8 characters, with at least one letter and one digit.
 * Returns a Ukrainian error message, or null when the password is acceptable.
 * Mirror the minimum length in Supabase Auth settings; character rules live here
 * because leaked-password protection is not available on the Free plan.
 */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Пароль має містити щонайменше ${MIN_PASSWORD_LENGTH} символів.`;
  }
  if (!/\p{L}/u.test(password)) {
    return "Додай у пароль хоча б одну літеру.";
  }
  if (!/\d/.test(password)) {
    return "Додай у пароль хоча б одну цифру.";
  }
  return null;
}
