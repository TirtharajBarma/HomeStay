import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Darjeeling HomeStay | Hillside Homestays & Tea Estate Stays",
    template: "%s | Darjeeling HomeStay",
  },
  description:
    "Six handpicked homestays, heritage bungalows and working tea estates across Darjeeling, West Bengal — at the rates each property publishes.",
  openGraph: {
    siteName: "Darjeeling HomeStay",
    locale: "en_IN",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${playfair.variable} ${jakarta.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body className="flex min-h-full flex-col bg-surface font-body text-body-md text-on-surface selection:bg-primary-fixed selection:text-primary">
        {children}
      </body>
    </html>
  );
}
