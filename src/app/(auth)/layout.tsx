import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar Sesión",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
