import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, ShieldCheck, UserRound, ClipboardCheck } from "lucide-react";
import { Card, Field } from "@/components/portal/Shell";
import { useProfile } from "@/lib/use-profile";

export const Route = createFileRoute("/portal/info")({
  head: () => ({
    meta: [
      { title: "بيانات الطالب — بوابة الطالب" },
      { name: "description", content: "البيانات الشخصية والأكاديمية وبيانات القيد للطالب." },
      { property: "og:title", content: "بيانات الطالب — بوابة الطالب" },
      { property: "og:description", content: "البيانات الشخصية والأكاديمية للطالب." },
    ],
  }),
  component: Info,
});

function Info() {
  const p = useProfile();
  const extra = (p.extra ?? {}) as Record<string, string>;
  const parts = p.full_name_ar.split(" ");
  const initials = parts.slice(0, 2).map((w) => w[0]).join("");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 rounded-2xl bg-hero p-8 text-primary-foreground shadow-elevated">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-2 border-primary-foreground/30 bg-primary-foreground/10 text-2xl font-bold">{initials}</div>
        <div>
          <h2 className="text-2xl font-bold md:text-3xl">{p.full_name_ar}</h2>
          <div className="mt-2 font-mono text-sm opacity-85">ID: {p.student_code} · {p.full_name_en}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="البيانات الشخصية" icon={UserRound}>
          <div className="grid grid-cols-2 gap-6">
            <Field label="الاسم الأول" value={parts[0]} />
            <Field label="باقي الاسم" value={parts.slice(1).join(" ")} />
            <Field label="الاسم بالإنجليزية" value={p.full_name_en} />
            <Field label="الرقم القومي" value={p.national_id} mono />
            <Field label="النوع" value={p.gender} />
            <Field label="تاريخ الميلاد" value={extra.birth_date} />
            <Field label="الهاتف" value={p.phone} />
            <Field label="البريد الإلكتروني" value={null} />
          </div>
        </Card>
        <Card title="البيانات الأكاديمية" icon={GraduationCap}>
          <div className="grid grid-cols-2 gap-6">
            <Field label="الرقم الجامعي" value={p.student_code} mono />
            <Field label="اسم المستخدم" value={p.username} mono />
            <Field label="الكلية" value={p.faculty} />
            <Field label="البرنامج" value={p.program} />
            <Field label="المستوى الأكاديمي" value={p.academic_level} />
            <Field label="العام الأكاديمي" value={p.academic_year} />
            <Field label="الحالة الأكاديمية" value={<span className="rounded-full bg-success-soft px-2.5 py-0.5 text-sm text-success">{p.academic_status}</span>} />
            <Field label="المعدل التراكمي" value={Number(p.cgpa).toFixed(2)} mono />
          </div>
        </Card>
      </div>

      <Card title="بيانات القيد" icon={ClipboardCheck}>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="رقم طلب الالتحاق" value={extra.application_no} mono />
          <Field label="المؤهل" value={extra.certificate} />
          <Field label="المجموعة" value={<span dir="ltr">{extra.group}</span>} />
          <Field label="الساعات المكتسبة" value={p.earned_hours} />
        </div>
      </Card>

      <Card title="الأمان" icon={ShieldCheck}>
        <p className="text-sm text-muted-foreground">
          هذا حساب تجريبي مخصص للعرض. تغيير كلمة المرور غير متاح في وضع المحاكاة.
        </p>
      </Card>
    </div>
  );
}
