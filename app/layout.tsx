import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import PwaRegister from "@/components/pwa/pwa-register";
import InstallPrompt from "@/components/pwa/install-prompt";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: "Fábrica de Luz · Central de Comando",
    template: "%s · Fábrica de Luz",
  },
  description:
    "Sistema de gestão de projetos, cronogramas e ordens de serviço de decoração natalina da Fábrica de Luz.",
  applicationName: "Fábrica de Luz",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fábrica de Luz",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#16051f" },
    { media: "(prefers-color-scheme: light)", color: "#f4f1f9" },
  ],
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <InstallPrompt />
        </ThemeProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
