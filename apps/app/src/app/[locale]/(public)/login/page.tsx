import { AuthForm } from "@/components/auth-form";
import Image from "next/image";

export const metadata = {
  title: "Sign In — Ollagraphic",
};

export default function LoginPage() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center">
      <div className="flex flex-col items-center justify-center gap-4 py-8">
        <Image src="/logo.png" alt="Ollagraphic" width={96} height={96} />
        <AuthForm />
      </div>
    </div>
  );
}
