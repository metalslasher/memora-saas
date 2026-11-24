# Program word lists

Source: the NGSL Project, https://www.newgeneralservicelist.com (downloaded 2026-11-24).
All lists are licensed under Creative Commons Attribution-ShareAlike 4.0
International (CC BY-SA 4.0), commercial use allowed. This folder is a
redistribution of that data and stays under CC BY-SA 4.0.

| File | List | Authors |
|---|---|---|
| `NGSL_12_stats.csv` | New General Service List 1.2 (2,809 lemmas) | Browne, C., Culligan, B., Phillips, J. |
| `NGSL-Spoken_12_stats.csv` | New General Service List-Spoken 1.2 (721 lemmas) | Browne, C., Culligan, B. |
| `BSL_120_stats.csv` | Business Service List 1.20 (1,700 lemmas) | Browne, C., Culligan, B. |
| `frequency_12k.csv` | First 12,000 lemmas of "NGSL with SFI (31K)" by raw frequency rank (column `list`: NGSL / NAWL / Sup / empty) | Browne, C., Culligan, B., Phillips, J. |

Changes: `frequency_12k.csv` is an extract (lemma, raw frequency rank, list)
of the 3.6 MB research spreadsheet; lemmas were lowercased and entries with
digits or other symbols dropped. The other files are unchanged.

`themes_*.csv` (themed phrases and collocations) are Memora's own lists,
generated once with AI and reviewed by hand (`scripts/build-themes.ts`).

Import into the shared `lexicon`: `npx tsx --env-file=.env.local scripts/import-lexicon.ts`
(idempotent).
