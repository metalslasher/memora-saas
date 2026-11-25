"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { safeNextPath } from "@/lib/memora/share";
import { buttonClass, type ButtonSize, type ButtonVariant } from "../button-class";
import { hardNavigate } from "../hard-navigate";
import type { AuthModal as AuthModalType } from "../auth";

/**
 * The only interactive part of the landing besides the demo: sign-in / sign-up.
 * The Supabase client and the dialog load on demand (first click, or an email
 * link that brings a one-time code), so the landing itself stays light.
 */
type AuthMode = "sign-in" | "sign-up";

const store = {
  mode: null as AuthMode | null,
  signedIn: false,
  listeners: new Set<() => void>(),
  set(patch: Partial<{ mode: AuthMode | null; signedIn: boolean }>) {
    Object.assign(store, patch);
    store.listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    store.listeners.add(listener);
    return () => store.listeners.delete(listener);
  },
};

function useSignedIn() {
  return useSyncExternalStore(store.subscribe, () => store.signedIn, () => false);
}

function useAuthMode() {
  return useSyncExternalStore(store.subscribe, () => store.mode, () => null);
}

/** The session cookie set by @supabase/ssr is readable, so no request is needed to know. */
function hasSessionCookie() {
  return document.cookie.split(";").some((part) => /^\s*sb-[^=]+-auth-token(\.0)?=/.test(part));
}

function nextPath() {
  return safeNextPath(new URLSearchParams(window.location.search).get("next"));
}

export function AuthButton({
  mode,
  children,
  variant = "primary",
  size = "lg",
  className = "",
  hideWhenSignedIn = false,
}: {
  mode: AuthMode;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  hideWhenSignedIn?: boolean;
}) {
  const signedIn = useSignedIn();
  if (signedIn) {
    if (hideWhenSignedIn) return null;
    return (
      <a className={buttonClass(variant, size, className)} href="/app">
        Відкрити Memora
        <ArrowRight className="size-4" />
      </a>
    );
  }
  return (
    <button className={buttonClass(variant, size, className)} onClick={() => store.set({ mode })} type="button">
      {children}
    </button>
  );
}

type SupabaseClient = ReturnType<typeof import("@/lib/supabase/browser").createSupabaseBrowserClient>;

let clientPromise: Promise<SupabaseClient> | null = null;
function loadClient() {
  clientPromise ??= import("@/lib/supabase/browser").then(({ createSupabaseBrowserClient }) =>
    createSupabaseBrowserClient(),
  );
  return clientPromise;
}

export function AuthRoot() {
  const mode = useAuthMode();
  const [Modal, setModal] = useState<typeof AuthModalType | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    store.set({ signedIn: hasSessionCookie() });
    // A guest sent here from an app page (e.g. a share) signs in and goes back there.
    if (nextPath()) store.set({ mode: "sign-in" });

    // Email links (sign-up confirmation, password reset) land here with a one-time
    // code; the browser client exchanges it on load and we move on.
    const params = new URLSearchParams(window.location.search);
    if (!params.has("code") && !params.has("token_hash") && !window.location.hash.includes("access_token")) return;
    let unsubscribe = () => {};
    void loadClient().then((supabase) => {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY") hardNavigate("/app/settings?recovery=1");
        else if (event === "SIGNED_IN" && session) hardNavigate(nextPath() ?? "/app");
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!mode || Modal) return;
    void import("../auth").then((module) => setModal(() => module.AuthModal));
  }, [mode, Modal]);

  if (!mode || !Modal) return null;
  const home = nextPath() ?? "/app";

  async function signIn(email: string, password: string) {
    setStatusMessage(null);
    const supabase = await loadClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    hardNavigate(home);
  }

  async function signUp(email: string, password: string) {
    setStatusMessage(null);
    const supabase = await loadClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
    // Supabase hides existing accounts: it "succeeds" with no identities and
    // sends no email, so tell the person to sign in instead.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      throw new Error("Акаунт з таким email уже існує. Увійди або скористайся «Забули пароль?».");
    }
    if (data.session) {
      hardNavigate("/app");
      return;
    }
    setStatusMessage("Акаунт створено. Ми надіслали лист для підтвердження — перейди за посиланням у ньому.");
  }

  async function resetPassword(email: string) {
    const cleanEmail = email.trim();
    if (!cleanEmail) throw new Error("Вкажи email, на який надіслати лист.");
    setStatusMessage(null);
    const supabase = await loadClient();
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
    setStatusMessage("Лист для відновлення пароля надіслано. Перевір пошту.");
  }

  return (
    <Modal
      initialMode={mode}
      statusMessage={statusMessage}
      onClose={() => store.set({ mode: null })}
      onResetPassword={resetPassword}
      onSignIn={signIn}
      onSignUp={signUp}
    />
  );
}
