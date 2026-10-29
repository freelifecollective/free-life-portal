import type { Metadata, Viewport } from "next";
import { Lato, Playfair_Display, Raleway } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});
const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-lato", display: "swap" });
const raleway = Raleway({
  subsets: ["latin"],
  weight: ["300", "500", "600", "700"],
  variable: "--font-raleway",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Free Life Collective", template: "%s | Free Life Collective" },
  description: "The Free Life Collective community portal.",
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "FLC", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#F6F5F1", viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${playfair.variable} ${lato.variable} ${raleway.variable}`}>
      <body>
        {/* Catches the browser's "install" offer as early as possible; the Get the App page uses it for its Install button. */}
        <Script id="flc-install-capture" strategy="beforeInteractive">{`window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__flcInstall=e;window.dispatchEvent(new Event("flc:installready"))});window.addEventListener("appinstalled",function(){try{localStorage.setItem("flc_app_installed","1")}catch(e){}window.__flcInstall=null;window.dispatchEvent(new Event("flc:installed"))});`}</Script>
        {children}
      </body>
    </html>
  );
}
