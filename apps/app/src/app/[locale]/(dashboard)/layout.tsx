import { WorkspaceProvider } from "@/lib/workspace-provider";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@v1/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { cookies } from "next/headers";
import { getDb } from "@/lib/localDb";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { CommandPalette } from "./_components/command-palette";
import { Sidebar } from "./_components/sidebar";
import { Topbar } from "./_components/topbar";

export default async function Layout({
  children,
}: { children: React.ReactNode }) {
  let user: any = null;
  if (process.env.NODE_ENV === "development") {
    const email = cookies().get("mock_auth")?.value;
    if (email) {
      const db = getDb();
      const matched = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (matched) {
        user = { ...matched, username: matched.email.split("@")[0] };
      }
    }
    if (!user) {
      user = { username: "developer", name: "Local Developer", email: "dev@local.com" };
    }
  } else {
    user = { username: "developer", name: "Local Developer", email: "dev@local.com" };
  }
  if (process.env.NODE_ENV !== "development") {
    try {
      const dbUser = await fetchQuery(
        api.users.getUser,
        {},
        { token: await convexAuthNextjsToken() },
      );
      if (dbUser) user = dbUser;
    } catch (e) {
      console.warn("Convex connection failed, using local developer session.");
    }
  }
  if (!user?.username) {
    return redirect("/onboarding");
  }
  return (
    <WorkspaceProvider>
      <div className="min-h-screen w-full bg-secondary dark:bg-black md:flex">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <div className="min-h-0 flex-1">{children}</div>
        </main>
      </div>
      <Toaster richColors position="top-right" />
      <CommandPalette />
    </WorkspaceProvider>
  );
}
