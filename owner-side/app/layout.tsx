import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/components/auth-context";
import { CurrencyProvider } from "@/components/currency-provider";
import { EstateProvider } from "@/components/estate-provider";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Host Portal",
    template: "%s | Host Portal",
  },
  description:
    "Homestay management, room inventory, fleet transit dispatch and analytics.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${jakarta.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Material Symbols is not available via next/font/google. The rule
            below only targets pages/_document and is a false positive here:
            this is the App Router root layout, so it applies to every route. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="min-h-full bg-surface font-body-md text-on-surface selection:bg-primary selection:text-on-primary">
        <AuthProvider>
          <CurrencyProvider>
            <EstateProvider>{children}</EstateProvider>
          </CurrencyProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
