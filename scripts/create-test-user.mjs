// Creates (or resets the password of) a confirmed e2e test user via the
// Supabase Admin API and stores its credentials in .env.local.
// Usage: pnpm test-user [email]
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const envPath = ".env.local";
const email = process.argv[2] ?? "memora.e2e@example.com";

function readEnvFile() {
  return existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
}

function readEnvValue(text, key) {
  const match = text.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : undefined;
}

function upsertEnv(text, values) {
  let next = text;
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    if (pattern.test(next)) {
      next = next.replace(pattern, line);
    } else {
      next += (next === "" || next.endsWith("\n") ? "" : "\n") + line + "\n";
    }
  }
  return next;
}

function generatePassword() {
  // Letters + digits guarantee the password policy (8+, letter and digit).
  return `Mm${randomBytes(12).toString("base64url")}9`;
}

async function findUserByEmail(admin) {
  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

const envText = readEnvFile();
const url = readEnvValue(envText, "NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = readEnvValue(envText, "SUPABASE_SERVICE_ROLE_KEY");

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const password = generatePassword();
const existing = await findUserByEmail(admin);
let userId = existing?.id;

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (error) throw error;
  console.log(`Reset password for ${email}.`);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user.id;
  console.log(`Created confirmed user ${email}.`);
}

await seedPractice(userId);

writeFileSync(
  envPath,
  upsertEnv(envText, { MEMORA_SMOKE_EMAIL: email, MEMORA_SMOKE_PASSWORD: password }),
);
console.log("Saved MEMORA_SMOKE_EMAIL / MEMORA_SMOKE_PASSWORD to .env.local.");

/**
 * Replaces the user's words with four that put one card of each exercise
 * type in today's queue (one card per word a day, so each type needs a word).
 */
async function seedPractice(id) {
  const day = 86_400_000;
  const at = (days) => new Date(Date.now() + days * day).toISOString();
  const review = (kind, dueInDays) => ({
    kind,
    state: "Review",
    due: at(dueInDays),
    stability: 6,
    difficulty: 5,
    scheduled_days: 6,
    reps: 3,
    last_review: at(dueInDays - 6),
  });
  const words = [
    {
      lemma: "reliable",
      content: {
        translations: ["надійний"],
        part_of_speech: "adjective",
        examples: [{ en: "She's the most reliable person on the team.", uk: "Вона найнадійніша людина в команді." }],
      },
      cards: [{ kind: "recognition", state: "New", due: at(0) }],
    },
    {
      lemma: "figure out",
      content: {
        translations: ["зрозуміти", "розібратися"],
        part_of_speech: "phrasal verb",
        examples: [{ en: "I can't figure out how this works.", uk: "Не можу розібратися, як це працює." }],
      },
      cards: [review("recognition", 4), review("recall", -1)],
    },
    {
      lemma: "commute",
      content: {
        translations: ["дорога на роботу"],
        part_of_speech: "noun",
        examples: [{ en: "My commute takes about forty minutes.", uk: "Дорога на роботу забирає хвилин сорок." }],
      },
      cards: [review("recognition", 5), review("recall", 3), review("cloze", -1)],
    },
    {
      lemma: "thorough",
      content: {
        translations: ["ретельний"],
        part_of_speech: "adjective",
        examples: [{ en: "The doctor did a thorough checkup.", uk: "Лікар провів ретельний огляд." }],
      },
      cards: [review("recognition", 5), review("recall", 3), review("listening", -1)],
    },
  ];

  const { error: wipeError } = await admin.from("user_words").delete().eq("user_id", id);
  if (wipeError) throw wipeError;
  for (const word of words) {
    const { data, error } = await admin
      .from("user_words")
      .insert({ user_id: id, lemma: word.lemma, content: word.content, source: "manual" })
      .select("id")
      .single();
    if (error) throw error;
    const { error: cardError } = await admin
      .from("cards")
      .insert(word.cards.map((card) => ({ ...card, user_id: id, user_word_id: data.id })));
    if (cardError) throw cardError;
  }
  console.log(`Seeded ${words.length} words: one card of every exercise type is due.`);
}
