"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#f9fafb] dark:bg-[#09090b] text-[#18181b] dark:text-[#f4f4f5] p-4 overflow-hidden overscroll-none touch-none select-none font-sans">
      <div className="flex flex-col items-center text-center max-w-lg mx-auto">
        {/* Animated 404 Ghost Illustration */}
        <div className="relative flex items-center justify-center mb-6">
          <div className="relative flex items-center text-[#e11440] font-black text-[130px] sm:text-[160px] leading-none tracking-tight font-display">
            <span>4</span>
            <div className="relative inline-flex items-center justify-center mx-1">
              <span>0</span>
              {/* Cute Floating Ghost */}
              <div className="absolute -top-9 sm:-top-11 left-1/2 -translate-x-1/2 w-16 sm:w-20 pointer-events-none animate-float-ghost">
                <svg
                  viewBox="0 0 100 120"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-auto drop-shadow-lg"
                >
                  {/* Ghost Body */}
                  <path
                    d="M50 12C28 12 12 28 12 50C12 74 14 102 20 99C26 96 32 106 40 103C48 100 52 106 60 103C68 100 74 106 80 99C86 92 88 74 88 50C88 28 72 12 50 12Z"
                    fill="white"
                  />
                  {/* Left Eye */}
                  <ellipse cx="40" cy="42" rx="4" ry="5.5" fill="#18181b" />
                  {/* Right Eye */}
                  <ellipse cx="60" cy="42" rx="4" ry="5.5" fill="#18181b" />
                  {/* Surprised Open Mouth */}
                  <ellipse cx="50" cy="56" rx="5.5" ry="8" fill="#18181b" />
                  {/* Ghost Left Arm */}
                  <path
                    d="M14 54C8 57 2 51 6 45C10 39 18 44 16 52"
                    fill="white"
                  />
                  {/* Ghost Right Arm */}
                  <path
                    d="M86 54C92 57 98 51 94 45C90 39 82 44 84 52"
                    fill="white"
                  />
                </svg>
              </div>
            </div>
            <span>4</span>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-sans">
          Page not found
        </h1>

        {/* Subtitle matching screenshot */}
        <p className="text-sm sm:text-[15px] text-muted-foreground mt-3.5 leading-relaxed max-w-md">
          The Page you are looking for doesn&apos;t exist or an other error occured.{" "}
          <span className="block sm:inline mt-1 sm:mt-0">
            Go back, or head over to{" "}
            <Link
              href="/"
              className="text-[#e11440] font-bold hover:underline transition-colors"
            >
              Home
            </Link>
          </span>
        </p>
      </div>
    </div>
  );
}
