import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Loader2, Megaphone } from "lucide-react";
import { Card } from "@/components/portal/Shell";
import { Button } from "@/components/ui/button";
import { EVENT_KIND_LABEL } from "@/lib/portal-data";
import { usePortalSnapshot } from "@/lib/use-profile";

export const Route = createFileRoute("/portal/events")({
  head: () => ({
    meta: [
      { title: "الإعلانات والفعاليات — بوابة الطالب" },
      { name: "description", content: "الإعلانات الرسمية والفعاليات والاختبارات الموجهة للطالب." },
    ],
  }),
  component: StudentEventsPage,
});

function StudentEventsPage() {
  const { data: snap, isLoading, isError, refetch } = usePortalSnapshot();
  if (isLoading) {
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (isError || !snap) {
    return (
      <div className="space-y-4 rounded-xl border bg-card p-8 text-center">
        <p className="text-destructive">تعذر تحميل الإعلانات والفعاليات.</p>
        <Button variant="outline" onClick={() => refetch()}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }
  const announcements = snap.announcements;
  const events = snap.events;

  return (
    <div className="space-y-6">
      <Card title="الإعلانات المنشورة" icon={Megaphone}>
        {announcements.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">لا توجد إعلانات منشورة حاليًا.</p>
        ) : (
          <div className="space-y-4">
            {announcements.map((a) => (
              <article key={a.id} className="rounded-xl border bg-muted/20 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold">{a.title}</h3>
                  {a.published_at && (
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {new Date(a.published_at).toLocaleDateString("ar-EG")}
                    </span>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{a.body}</p>
              </article>
            ))}
          </div>
        )}
      </Card>

      <Card title="الفعاليات الأكاديمية والاختبارات" icon={CalendarDays}>
        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">لا توجد فعاليات أكاديمية منشورة حاليًا.</p>
        ) : (
          <div className="divide-y">
            {events.map((ev) => (
              <article key={ev.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">{ev.title}</h3>
                    <span className="rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-medium text-primary">
                      {EVENT_KIND_LABEL[ev.event_type]}
                    </span>
                  </div>
                  {ev.description && <p className="mt-1 text-sm text-muted-foreground">{ev.description}</p>}
                  {ev.location && <p className="mt-1 text-xs text-muted-foreground">المكان: {ev.location}</p>}
                </div>
                <div className="shrink-0 font-mono text-xs text-muted-foreground" dir="ltr">
                  {new Date(ev.starts_at).toLocaleString("ar-EG")}
                  {ev.ends_at ? ` → ${new Date(ev.ends_at).toLocaleString("ar-EG")}` : ""}
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
