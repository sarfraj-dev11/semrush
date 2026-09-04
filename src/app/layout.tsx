import type { Metadata } from "next";
import { Quicksand, Syncopate } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const syncopate = Syncopate({
  subsets: ["latin"],
  variable: "--font-syncopate",
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SEO Console",
  description: "Internal SEO client and site analysis panel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body
        className={`${quicksand.variable} ${syncopate.variable} font-sans min-h-full antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              className:
                "!rounded-xl !border !border-border !bg-surface !text-foreground !shadow-lg",
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
