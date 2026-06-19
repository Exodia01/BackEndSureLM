import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import SplashScreen from "@/components/SplashScreen";


const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SureIm — Insurance for Rural India",
  description: "AI-powered insurance platform for rural communities",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html suppressHydrationWarning>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Geom:ital,wght@0,300..900;1,300..900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet" />
        </head>
        <body>
          <SplashScreen />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}