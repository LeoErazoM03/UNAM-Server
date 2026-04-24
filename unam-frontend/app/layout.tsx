import "@/lib/fix-return-nan";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ApolloProviderWrapper from "@/components/providers/ApolloProvider";
import { AccessibilityProvider } from "@/components/accessibility/AccessibilityContext";
import { AccessibilityButton } from "@/components/accessibility/AccessibilityButton";
import AccessibilityMenu from "@/components/accessibility/AccessibilityMenu";
import { InfoButton } from "@/components/InfoButton";
import { FeedbackButton } from "@/components/FeedbackButton";
import { AuthProvider } from "@/contexts/AuthContext";
import AccessibilityTutorial from "@/components/accessibility/AccessibilityTutorial";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UNAM - Sistema de Gestión Educativa",
  description:
    "Plataforma educativa para la gestión de contenidos, usuarios y ejercicios académicos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AccessibilityProvider>
          <AuthProvider>
            <ApolloProviderWrapper>
              {children}
              <AccessibilityButton />
              <AccessibilityTutorial />
              <InfoButton />
              <FeedbackButton />
              <AccessibilityMenu />
            </ApolloProviderWrapper>
          </AuthProvider>
        </AccessibilityProvider>
      </body>
    </html>
  );
}