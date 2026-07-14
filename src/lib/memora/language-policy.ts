export const memoraLanguagePolicy = {
  interfaceLanguage: "uk-UA",
  english: {
    targetLanguage: "en",
    supportLanguage: "uk",
    productiveDirection: "uk-to-en",
    receptiveDirection: "en-to-uk",
  },
  qa: {
    termLanguage: "en-or-common-technical",
    explanationLanguage: "uk",
  },
} as const;

export function hasUkrainianSignal(value: string) {
  return /[А-Яа-яІіЇїЄєҐґ]/.test(value);
}
