import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aegis Swap Engine",
  description: "Swap orchestration — PancakeSwap V2 on BSC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
