import type { ReactNode } from "react";
import { LogoMark, Wordmark } from "./Logo";
import { BookBase, BookDoodle } from "./Decor";

/** Mobile-first frame shared by login, sign up and password screens. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-muted">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-background">
        <header className="relative bg-brand-gradient header-arc px-6 pb-12 pt-10 text-center">
          <LogoMark className="mx-auto size-28 animate-logo-rise" />
          <Wordmark
            className="mt-4 animate-fade-up text-[2.75rem]"
            taglineClassName="text-base"
          />
        </header>

        <BookDoodle className="absolute left-3 top-[18rem] w-14 rotate-[-12deg] text-primary/15" />
        <BookDoodle className="absolute right-3 top-[18rem] w-14 rotate-[12deg] text-primary/15" />

        <main className="relative z-10 flex-1 px-6 pb-6 pt-8">{children}</main>

        <BookBase className="h-20" />
      </div>
    </div>
  );
}
