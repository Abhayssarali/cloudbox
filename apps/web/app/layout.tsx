import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CloudBox — Your Personal Cloud",
    template: "%s | CloudBox",
  },
  description:
    "Turn your old laptop into a personal cloud storage server. Access your files from anywhere, securely.",
  keywords: ["cloud storage", "personal cloud", "self-hosted", "file sharing"],
  openGraph: {
    type: "website",
    title: "CloudBox — Your Personal Cloud",
    description:
      "Turn your old laptop into a personal cloud storage server. Access your files from anywhere, securely.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
