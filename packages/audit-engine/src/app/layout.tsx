export const metadata = {
  title: 'Aegis Audit Engine',
  description: 'The permanent memory of the AEGIS ecosystem.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
