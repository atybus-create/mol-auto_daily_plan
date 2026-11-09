import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import { safeReturnPath, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const cookieStore = await cookies();
  const params = await searchParams;
  const returnTo = safeReturnPath(params.next);

  if (verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value)) redirect(returnTo);

  return (
    <main className="login-page">
      <div className="login-utility">ESTYL · OPERACJE MAGAZYNOWE</div>
      <section className="login-card" aria-labelledby="login-title">
        <Image className="login-logo" src="/estyl-pl-logo.png" alt="ESTYL.PL" width={320} height={102} priority />
        <div className="login-module">
          <p className="module-eyebrow">MOL / WYDANIE</p>
          <h1 id="login-title">Plan dnia</h1>
          <p>Zaloguj się, aby otworzyć plan pracy magazynu.</p>
        </div>
        <LoginForm returnTo={returnTo} />
      </section>
      <p className="login-footer">ESTYL.PL · MOL Plan Dnia</p>
    </main>
  );
}
