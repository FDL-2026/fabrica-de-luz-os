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
        {/* Splash interna do PWA: exibida uma vez por abertura (só no app
            instalado), some quando o app termina de carregar. É a forma
            confiável de mostrar a logo no carregamento — o Android não aceita
            imagem de splash customizada via manifesto. */}
        <div
          id="fdl-boot-splash"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483000,
            display: "none",
            alignItems: "center",
            justifyContent: "center",
            background: "#5a3583",
            transition: "opacity .45s ease",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/V_TAGLINE_CF_ROXO.png"
            alt="Fábrica de Luz"
            style={{ width: "78%", maxWidth: "340px", height: "auto" }}
          />
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var el=document.getElementById('fdl-boot-splash');if(!el)return;try{var standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;if(!standalone||sessionStorage.getItem('fdl_splash')){el.remove();return;}sessionStorage.setItem('fdl_splash','1');el.style.display='flex';var start=Date.now(),MIN=700;function hide(){el.style.opacity='0';setTimeout(function(){el.remove();},450);}addEventListener('load',function(){setTimeout(hide,Math.max(0,MIN-(Date.now()-start)));});setTimeout(hide,4000);}catch(e){el.remove();}})();`,
          }}
        />

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
