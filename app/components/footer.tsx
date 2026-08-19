import { ArrowUpRight } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <a
          href="mailto:hello@example.com"
          className="inline-flex w-fit items-center gap-1 font-medium underline decoration-1 underline-offset-4 transition-opacity hover:opacity-50"
        >
          hello@example.com
          <ArrowUpRight
            className="size-4"
            aria-hidden="true"
          />
        </a>

        <p className="text-white/45">
          &copy; {new Date().getFullYear()} Your Name. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
