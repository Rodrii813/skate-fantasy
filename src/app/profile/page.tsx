import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";
import NicknameForm from "./NicknameForm";
import NotificationToggle from "./NotificationToggle";
import InstallCard from "./InstallCard";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/profile");
  }

  const locale = getLocale();
  const t = getDictionary(locale).profile;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-xl font-black text-slate-50">👤 {t.title}</h1>
          <p className="text-xs text-slate-400 mt-1">{t.subtitle}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">{t.emailLabel}</p>
          <p className="text-sm text-slate-200">{session.user.email}</p>
        </div>

        <NicknameForm currentName={session.user.name || ""} />

        <InstallCard />

        <NotificationToggle />
      </div>
    </div>
  );
}
