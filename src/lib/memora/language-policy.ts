export function hasUkrainianSignal(value: string) {
  return /[А-Яа-яІіЇїЄєҐґ]/.test(value);
}
