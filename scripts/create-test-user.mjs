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

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (error) throw error;
  console.log(`Reset password for ${email}.`);
} else {
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  console.log(`Created confirmed user ${email}.`);
}

writeFileSync(
  envPath,
  upsertEnv(envText, { MEMORA_SMOKE_EMAIL: email, MEMORA_SMOKE_PASSWORD: password }),
);
console.log("Saved MEMORA_SMOKE_EMAIL / MEMORA_SMOKE_PASSWORD to .env.local.");
