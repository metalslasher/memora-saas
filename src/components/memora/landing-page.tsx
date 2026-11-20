"use client";

import { ArrowRight, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { checkAnswer } from "@/lib/memora/answer-check";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AuthModal } from "./auth";
import { LogoMark, Wordmark } from "./brand";
import { Hero } from "./landing/hero";
import { Reveal } from "./landing/motion";
import { Bento, CurveSection, Faq, Marquee, ScrollStatement, StickySteps } from "./landing/sections";
import { Badge, buttonClass, Kbd } from "./shared-ui";
import { SpeakButton } from "./speech";
import { hardNavigate } from "./hard-navigate";

type AuthMode = "sign-in" | "sign-up";

export function LandingPage({ isSignedIn }: { isSignedIn: boolean }) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [authMode, setAuthMode] = useState<AuthMode>("sign-up");
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Email links (sign-up confirmation, password reset) land here with a
  // one-time code; the browser client exchanges it and we move on.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") hardNavigate("/app/settings?recovery=1");
      else if (event === "SIGNED_IN" && session && !isSignedIn) hardNavigate("/app");
    });
    return () => subscription.unsubscribe();
  }, [isSignedIn, supabase]);

  function openAuth(mode: AuthMode) {
    if (isSignedIn) {
      hardNavigate("/app");
      return;
    }
    setAuthMode(mode);
    setIsAuthOpen(true);
  }

  async function signIn(email: string, password: string) {
    setStatusMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    hardNavigate("/app");
  }

  async function signUp(email: string, password: string) {
    setStatusMessage(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;

    // Supabase hides existing accounts: it "succeeds" with no identities and
    // sends no email, so tell the learner to sign in instead.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      throw new Error("Акаунт з таким email уже існує. Увійди або скористайся «Забули пароль?».");
    }
    if (data.session) {
      hardNavigate("/app");
      return;
    }
    setStatusMessage(
      "Акаунт створено. Ми надіслали лист для підтвердження — перейди за посиланням, і можна починати.",
    );
  }

  async function resetPassword(email: string) {
    const cleanEmail = email.trim();
    if (!cleanEmail) throw new Error("Вкажи email, на який надіслати лист.");
    setStatusMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
    setStatusMessage("Лист для відновлення пароля надіслано. Перевір пошту.");
  }

  return (
    <div className="min-h-svh overflow-x-clip bg-ink text-text">
      <NavBar
        isSignedIn={isSignedIn}
        onSignIn={() => openAuth("sign-in")}
        onStart={() => openAuth("sign-up")}
      />

      <main>
        <Hero onStart={() => openAuth("sign-up")} />
        <Marquee />
        <ScrollStatement />
        <StickySteps />
        <Bento />
        <CurveSection />
        <DemoSection />
        <Faq />
        <FinalCta onStart={() => openAuth("sign-up")} />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-faint sm:flex-row sm:items-center sm:justify-between md:px-6">
          <Wordmark markClassName="size-6" />
          <p className="inline-flex items-center gap-2">
            <ShieldCheck className="size-4" />
            Твої матеріали бачиш лише ти.
          </p>
        </div>
      </footer>

      {isAuthOpen ? (
        <AuthModal
          initialMode={authMode}
          statusMessage={statusMessage}
          onClose={() => setIsAuthOpen(false)}
          onResetPassword={resetPassword}
          onSignIn={signIn}
          onSignUp={signUp}
        />
      ) : null}
    </div>
  );
}

function NavBar({
  isSignedIn,
  onSignIn,
  onStart,
}: {
  isSignedIn: boolean;
  onSignIn: () => void;
  onStart: () => void;
}) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3">
      <div
        className={`mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 rounded-full border pl-4 pr-2 transition-all duration-500 ${
          isScrolled
            ? "border-line-strong bg-surface-1/80 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
            : "border-transparent bg-transparent"
        }`}
      >
        <a aria-label="Memora — на початок" href="#top">
          <Wordmark markClassName="size-7" />
        </a>
        <nav aria-label="Навігація" className="hidden items-center gap-1 text-sm text-muted md:flex">
          {[
            ["#how", "Як це працює"],
            ["#features", "Можливості"],
            ["#demo", "Спробувати"],
            ["#faq", "Питання"],
          ].map(([href, label]) => (
            <a key={href} className="rounded-full px-3.5 py-2 transition hover:bg-surface-3 hover:text-text" href={href}>
              {label}
            </a>
          ))}
        </nav>
        {isSignedIn ? (
          <Link className={buttonClass("primary", "sm", "rounded-full px-4")} href="/app">
            Відкрити Memora
            <ArrowRight className="size-4" />
          </Link>
        ) : (
          <div className="flex items-center gap-1">
            <button className={buttonClass("ghost", "sm", "rounded-full")} onClick={onSignIn} type="button">
              Увійти
            </button>
            <button className={buttonClass("primary", "sm", "rounded-full px-4")} onClick={onStart} type="button">
              Почати
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

const demoCards = [
  {
    prompt: "Як сказати англійською: нестабільний тест?",
    answer: "flaky test",
    example: "This flaky test fails only in CI.",
    speak: "flaky test",
  },
  {
    prompt: "Як сказати англійською: звикнути до чогось?",
    answer: "get used to",
    example: "You'll get used to it after a week or two.",
    speak: "get used to",
  },
  {
    prompt: "Що українською означає «to deploy»?",
    answer: "розгорнути, викотити реліз",
    example: "We deploy to production every Friday.",
    speak: "to deploy",
  },
];

function DemoSection() {
  return (
    <section className="relative scroll-mt-16 overflow-hidden px-4 py-24 md:px-6 md:py-32" id="demo">
      <div aria-hidden="true" className="absolute left-1/2 top-1/2 -z-10 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet/10 blur-[120px]" />
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Спробуй</p>
        <h2 className="mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
          Одна картка — і ти зрозумієш.
        </h2>
        <p className="mt-4 text-base text-muted md:text-lg">
          Напиши відповідь (можна з помилкою) і натисни Enter.
        </p>
      </Reveal>
      <Reveal className="mx-auto mt-12 max-w-lg" delay={120}>
        <DemoCard />
      </Reveal>
    </section>
  );
}

function DemoCard() {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [isRevealed, setIsRevealed] = useState(false);
  const card = demoCards[index % demoCards.length];
  const check = isRevealed ? checkAnswer(typed, { answers: [card.answer] }) : null;

  function next() {
    setIndex((value) => value + 1);
    setTyped("");
    setIsRevealed(false);
  }

  const verdict =
    check && check.verdict !== "empty"
      ? {
          exact: ["Точно!", "bg-accent-soft text-accent"],
          close: ["Майже — є описка", "bg-amber-soft text-amber"],
          form: ["Слово те, форма інша", "bg-amber-soft text-amber"],
          synonym: ["Синонім — теж підходить", "bg-amber-soft text-amber"],
          self: ["Порівняй за змістом", "bg-surface-4 text-text-2"],
          different: ["Не збігається", "bg-danger-soft text-danger"],
        }[check.verdict]
      : null;

  return (
    <div className="conic-border rounded-[30px] p-px shadow-[0_40px_120px_-40px_rgba(62,224,191,0.4)]">
      <article key={index} className="animate-card overflow-hidden rounded-[29px] bg-gradient-to-b from-surface-3 to-surface-2">
        <div className="flex items-center justify-between px-5 pt-5">
          <div className="flex gap-1.5">
            <Badge tone="green">Англійська</Badge>
            <Badge tone="violet">Нова</Badge>
          </div>
          <span className="font-mono text-xs text-faint">
            {(index % demoCards.length) + 1}/{demoCards.length}
          </span>
        </div>
        <div className="px-6 pb-6 pt-6 text-center">
          <h3 className="text-balance text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
            {card.prompt}
          </h3>
        </div>

        {!isRevealed ? (
          <form
            className="border-t border-line/70 bg-surface-1/40 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              setIsRevealed(true);
            }}
          >
            <label className="sr-only" htmlFor="demo-answer">
              Твоя відповідь
            </label>
            <input
              autoCapitalize="off"
              autoComplete="off"
              className="h-12 w-full rounded-2xl border border-line-strong bg-surface-1 px-4 text-base outline-none transition placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent/15"
              id="demo-answer"
              placeholder="Твоя відповідь"
              spellCheck={false}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
            <button className={buttonClass("primary", "lg", "mt-3 w-full")} type="submit">
              {typed.trim() ? "Перевірити" : "Показати відповідь"}
              <Kbd>Enter</Kbd>
            </button>
          </form>
        ) : (
          <div className="animate-reveal border-t border-line/70 bg-surface-1/40 px-6 py-5">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 text-2xl font-semibold leading-snug tracking-tight text-accent-strong">
                {card.answer}
              </p>
              {card.speak ? <SpeakButton text={card.speak} /> : null}
            </div>
            {verdict ? (
              <p className={`animate-pop mt-3 inline-flex rounded-lg px-2 py-1 text-xs font-semibold ${verdict[1]}`}>
                {verdict[0]}
              </p>
            ) : null}
            <p className="mt-3 text-sm italic leading-6 text-text-2">{card.example}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                className="flex h-14 flex-col items-center justify-center rounded-2xl border border-danger/25 bg-danger-soft text-[#ffb4aa] transition hover:border-danger/60"
                onClick={next}
                type="button"
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <RotateCcw className="size-3.5" />
                  Не згадав
                </span>
                <span className="font-mono text-[11px] opacity-75">10 хв</span>
              </button>
              <button
                className="flex h-14 flex-col items-center justify-center rounded-2xl bg-accent text-accent-ink transition hover:bg-accent-strong"
                onClick={next}
                type="button"
              >
                <span className="text-sm font-semibold">Згадав</span>
                <span className="font-mono text-[11px] opacity-75">3 дн</span>
              </button>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}

function FinalCta({ onStart }: { onStart: () => void }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-24 md:px-6 md:pb-32">
      <Reveal>
        <div className="conic-border relative rounded-[36px] p-px">
          <div className="glow-accent relative overflow-hidden rounded-[35px] px-6 py-16 text-center md:py-24">
            <LogoMark className="animate-float mx-auto size-14" />
            <h2 className="mx-auto mt-8 max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              Перша сесія — <span className="text-gradient">п’ять хвилин.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-md text-base leading-7 text-muted md:text-lg">
              Стартові картки вже готові. Створи акаунт і пройди їх просто зараз.
            </p>
            <button
              className={buttonClass(
                "primary",
                "lg",
                "mt-10 px-8 shadow-[0_0_0_1px_rgba(108,240,214,0.4),0_14px_40px_-10px_rgba(62,224,191,0.65)]",
              )}
              onClick={onStart}
              type="button"
            >
              Почати навчання
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
