import { useState } from "react";
import { Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { BrandMark } from "./Shell";
import { cn } from "@/lib/utils";

const schema = z.object({
  username: z.string().trim().min(1, "يرجى إدخال اسم المستخدم").max(64, "اسم المستخدم طويل جدًا"),
  password: z.string().min(1, "يرجى إدخال كلمة المرور").max(128),
});

export function LoginCard({
  title,
  subtitle,
  onSubmit,
  footer,
}: {
  title: string;
  subtitle: string;
  onSubmit: (u: string, p: string) => Promise<string | null>;
  footer?: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string; form?: string }>({});

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({ username: fd.get("username"), password: fd.get("password") });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      const nextErrors: { username?: string; password?: string } = {};
      if (f.username?.[0]) nextErrors.username = f.username[0];
      if (f.password?.[0]) nextErrors.password = f.password[0];
      return setErrors(nextErrors);
    }
    setErrors({});
    setBusy(true);
    const err = await onSubmit(parsed.data.username, parsed.data.password);
    setBusy(false);
    if (err) setErrors({ form: err });
  }

  const inputCls = (bad?: string) =>
    cn(
      "h-12 w-full rounded-lg border bg-gold-soft/60 pr-11 pl-11 text-[0.95rem] outline-none transition focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/25",
      bad && "border-destructive",
    );

  return (
    <div className="flex min-h-screen items-center justify-center bg-login p-4">
      <div className="page-enter w-full max-w-md rounded-2xl bg-card p-8 shadow-elevated sm:p-10">
        <div className="flex flex-col items-center text-center">
          <a
            href="https://www.facebook.com/share/1C1AG6nnue/"
            target="_blank"
            rel="noopener noreferrer"
            className="group block transition-transform hover:scale-105"
            title="جامعة حلوان الأهلية — Helwan National University"
          >
            <BrandMark className="h-16 w-16 rounded-2xl shadow-elevated" />
          </a>
          <h1 className="mt-5 text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <form onSubmit={handle} noValidate className="mt-8 space-y-5">
          <div>
            <label htmlFor="username" className="mb-1.5 block text-sm font-medium">اسم المستخدم</label>
            <div className="relative">
              <User className="absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input id="username" name="username" dir="ltr" autoComplete="username" className={inputCls(errors.username)} />
            </div>
            {errors.username && <p className="mt-1 text-xs text-destructive">{errors.username}</p>}
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="password"
                name="password"
                dir="ltr"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                className={inputCls(errors.password)}
              />
              <button
                type="button"
                aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                onClick={() => setShow((s) => !s)}
                className="absolute top-1/2 left-3 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
          </div>
          {errors.form && <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{errors.form}</div>}
          <Button type="submit" variant="brand" size="lg" disabled={busy} className="h-12 w-full text-base">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} تسجيل الدخول
          </Button>
        </form>
        <div className="mt-8 border-t pt-5 text-center text-xs text-muted-foreground">{footer}</div>
      </div>
    </div>
  );
}
