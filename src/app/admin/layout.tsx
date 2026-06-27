import { Sidebar } from "@/components/sidebar";
import { getSession } from "@/lib/actions";
import { initDatabase } from "@/lib/db-schema";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await initDatabase();

  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "administrador_general")) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Sidebar role={session.role} modules={session.modules} />
      <main className="lg:pl-64 pt-16 lg:pt-0">
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
