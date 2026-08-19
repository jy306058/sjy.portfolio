"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const navigation = [
  { label: "Work", href: "/work" },
  { label: "About", href: "/about" },
] as const;

export function Header() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const firstMenuLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstMenuLink.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#04081a]/20 backdrop-blur-sm">
        <div className="relative z-50 mx-auto flex h-18 w-full max-w-[1200px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link
            href="/"
            className="text-sm font-semibold uppercase tracking-[0.16em]"
            aria-label="홈으로 이동"
          >
            Your Name
          </Link>

          <nav
            className="hidden items-center gap-8 md:flex"
            aria-label="주요 메뉴"
          >
            {navigation.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition-opacity hover:opacity-50 ${
                    isActive
                      ? "underline decoration-1 underline-offset-8"
                      : ""
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            className="-mr-2 inline-flex size-11 items-center justify-center md:hidden"
            onClick={() => setIsOpen((open) => !open)}
            aria-label={isOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-controls="mobile-menu"
            aria-expanded={isOpen}
          >
            {isOpen ? (
              <X aria-hidden="true" />
            ) : (
              <Menu aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {/* header 바깥에 두어야 한다. header 의 backdrop-blur 가 fixed 자손의
          컨테이닝 블록이 되는 탓에, 안에 있으면 inset 이 뷰포트가 아니라 GNB
          박스를 기준으로 잡혀 메뉴가 GNB 자리에 그려진다.
          top-18 로 GNB 높이만큼 내리고, z-40 이라 z-50 인 GNB 가 늘 위에 남는다. */}
      <div
        id="mobile-menu"
        className={`fixed inset-x-0 bottom-0 top-18 z-40 bg-[#04081a] transition-opacity duration-300 md:hidden ${
          isOpen
            ? "visible opacity-100"
            : "invisible opacity-0"
        }`}
        aria-hidden={!isOpen}
      >
        <nav
          className="flex h-full flex-col justify-center gap-4 px-5 sm:px-8"
          aria-label="모바일 메뉴"
        >
          {navigation.map((item, index) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                ref={index === 0 ? firstMenuLink : undefined}
                href={item.href}
                tabIndex={isOpen ? 0 : -1}
                onClick={() => setIsOpen(false)}
                className="border-b border-white/15 py-4 text-5xl font-medium tracking-[-0.04em]"
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
