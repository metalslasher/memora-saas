import { LogoMark } from "@/components/memora/brand";

export default function Loading() {
  return (
    <div aria-label="Завантаження" className="grid min-h-[50svh] place-items-center" role="status">
      <div className="relative grid place-items-center">
        <span className="absolute size-16 animate-ping rounded-3xl bg-accent/10 [animation-duration:1.6s]" />
        <LogoMark className="relative size-10 animate-pulse" />
        <span className="sr-only">Завантаження</span>
      </div>
    </div>
  );
}
