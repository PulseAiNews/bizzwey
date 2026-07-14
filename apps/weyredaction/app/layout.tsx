import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "WeyRedaction · Comité de rédaction",
  description: "Salle éditoriale opérateur WeyMedia — mode observation."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
