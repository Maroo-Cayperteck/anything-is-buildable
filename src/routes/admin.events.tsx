import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Loader2, Megaphone, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/portal/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  adminDeleteAcademicEvent,
  adminDeleteAnnouncement,
  adminUpsertAcademicEvent,
  adminUpsertAnnouncement,
  getAcademicCatalog,
  listAdminCommunications,
} from "@/lib/admin.functions";
import { AUDIENCE_LABEL, EVENT_KIND_LABEL, type EventKind } from "@/lib/portal-data";
import type { AudienceScope } from "@/lib/documents-storage";

export const Route = createFileRoute("/admin/events")({
  component: AdminEventsPage,
});

function AdminEventsPage() {
  const qc = useQueryClient();
  const comms = useQuery({ queryKey: ["admin-comms"], queryFn: () => listAdminCommunications() });
  const catalog = useQuery({ queryKey: ["admin-academic-catalog"], queryFn: () => getAcademicCatalog() });

  // New Announcement form
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annAudience, setAnnAudience] = useState<AudienceScope>("all");
  const [annProgramId, setAnnProgramId] = useState("");
  const [annLevelId, setAnnLevelId] = useState("");
  const [annPublished, setAnnPublished] = useState(true);
  const [savingAnn, setSavingAnn] = useState(false);

  // New Event form
  const [evTitle, setEvTitle] = useState("");
  const [evDesc, setEvDesc] = useState("");
  const [evType, setEvType] = useState<EventKind>("academic");
  const [evStarts, setEvStarts] = useState("");
  const [evLocation, setEvLocation] = useState("");
  const [evAudience, setEvAudience] = useState<AudienceScope>("all");
  const [evProgramId, setEvProgramId] = useState("");
  const [evLevelId, setEvLevelId] = useState("");
  const [evPublished, setEvPublished] = useState(true);
  const [savingEv, setSavingEv] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-comms"] });

  async function createAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    setSavingAnn(true);
    try {
      await adminUpsertAnnouncement({
        data: {
          title: annTitle,
          body: annBody,
          audience_scope: annAudience,
          program_id: annAudience === "program" ? annProgramId || null : null,
          level_id: annAudience === "level" ? annLevelId || null : null,
          is_published: annPublished,
          is_archived: false,
        },
      });
      setAnnTitle("");
      setAnnBody("");
      await refresh();
      toast.success("تم حفظ الإعلان بنجاح");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر حفظ الإعلان");
    } finally {
      setSavingAnn(false);
    }
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setSavingEv(true);
    try {
      await adminUpsertAcademicEvent({
        data: {
          title: evTitle,
          description: evDesc,
          event_type: evType,
          starts_at: evStarts,
          location: evLocation,
          audience_scope: evAudience,
          program_id: evAudience === "program" ? evProgramId || null : null,
          level_id: evAudience === "level" ? evLevelId || null : null,
          is_published: evPublished,
        },
      });
      setEvTitle("");
      setEvDesc("");
      setEvLocation("");
      await refresh();
      toast.success("تم حفظ الفعالية بنجاح");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر حفظ الفعالية");
    } finally {
      setSavingEv(false);
    }
  }

  if (comms.isLoading) {
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const programs = catalog.data?.programs ?? [];
  const levels = catalog.data?.levels ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="إضافة إعلان جديد" icon={Megaphone}>
          <form onSubmit={createAnnouncement} className="space-y-4">
            <Input value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} placeholder="عنوان الإعلان" required />
            <Textarea value={annBody} onChange={(e) => setAnnBody(e.target.value)} rows={3} placeholder="نص الإعلان" required />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="rounded-lg border bg-background px-3 py-2 text-sm"
                value={annAudience}
                onChange={(e) => setAnnAudience(e.target.value as AudienceScope)}
              >
                <option value="all">جميع الطلاب</option>
                <option value="program">برنامج محدد</option>
                <option value="level">مستوى محدد</option>
              </select>
              {annAudience === "program" && (
                <select className="rounded-lg border bg-background px-3 py-2 text-sm" value={annProgramId} onChange={(e) => setAnnProgramId(e.target.value)}>
                  <option value="">اختر البرنامج</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name_ar}
                    </option>
                  ))}
                </select>
              )}
              {annAudience === "level" && (
                <select className="rounded-lg border bg-background px-3 py-2 text-sm" value={annLevelId} onChange={(e) => setAnnLevelId(e.target.value)}>
                  <option value="">اختر المستوى</option>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name_ar}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              نشر فورًا للطلاب
              <Switch checked={annPublished} onCheckedChange={setAnnPublished} />
            </label>
            <Button type="submit" variant="brand" disabled={savingAnn}>
              {savingAnn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} حفظ الإعلان
            </Button>
          </form>
        </Card>

        <Card title="إضافة فعالية أو اختبار" icon={CalendarDays}>
          <form onSubmit={createEvent} className="space-y-4">
            <Input value={evTitle} onChange={(e) => setEvTitle(e.target.value)} placeholder="عنوان الفعالية" required />
            <div className="grid gap-3 sm:grid-cols-2">
              <select className="rounded-lg border bg-background px-3 py-2 text-sm" value={evType} onChange={(e) => setEvType(e.target.value as EventKind)}>
                {(Object.keys(EVENT_KIND_LABEL) as EventKind[]).map((k) => (
                  <option key={k} value={k}>
                    {EVENT_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <Input type="datetime-local" dir="ltr" value={evStarts} onChange={(e) => setEvStarts(e.target.value)} required />
            </div>
            <Input value={evLocation} onChange={(e) => setEvLocation(e.target.value)} placeholder="المكان / القاعة (اختياري)" />
            <Textarea value={evDesc} onChange={(e) => setEvDesc(e.target.value)} rows={2} placeholder="وصف الفعالية (اختياري)" />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="rounded-lg border bg-background px-3 py-2 text-sm"
                value={evAudience}
                onChange={(e) => setEvAudience(e.target.value as AudienceScope)}
              >
                <option value="all">جميع الطلاب</option>
                <option value="program">برنامج محدد</option>
                <option value="level">مستوى محدد</option>
              </select>
              {evAudience === "program" && (
                <select className="rounded-lg border bg-background px-3 py-2 text-sm" value={evProgramId} onChange={(e) => setEvProgramId(e.target.value)}>
                  <option value="">اختر البرنامج</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name_ar}
                    </option>
                  ))}
                </select>
              )}
              {evAudience === "level" && (
                <select className="rounded-lg border bg-background px-3 py-2 text-sm" value={evLevelId} onChange={(e) => setEvLevelId(e.target.value)}>
                  <option value="">اختر المستوى</option>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name_ar}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              نشر الفعالية للطلاب
              <Switch checked={evPublished} onCheckedChange={setEvPublished} />
            </label>
            <Button type="submit" variant="brand" disabled={savingEv}>
              {savingEv ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} حفظ الفعالية
            </Button>
          </form>
        </Card>
      </div>

      <Card title={`الإعلانات (${comms.data?.announcements.length ?? 0})`} icon={Megaphone}>
        {(comms.data?.announcements.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">لا توجد إعلانات.</p>
        ) : (
          <div className="divide-y">
            {comms.data?.announcements.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {AUDIENCE_LABEL[a.audience_scope]} · {a.is_published ? "منشور" : "مسودة"} {a.is_archived ? "· مؤرشف" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await adminUpsertAnnouncement({
                          data: {
                            id: a.id,
                            title: a.title,
                            body: a.body,
                            audience_scope: a.audience_scope,
                            program_id: a.program_id,
                            level_id: a.level_id,
                            target_student_user_id: a.target_student_user_id,
                            is_published: !a.is_published,
                            is_archived: a.is_archived,
                          },
                        });
                        await refresh();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "تعذر التحديث");
                      }
                    }}
                  >
                    {a.is_published ? "إلغاء النشر" : "نشر"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={async () => {
                      try {
                        await adminDeleteAnnouncement({ data: { id: a.id } });
                        await refresh();
                        toast.success("تم حذف الإعلان");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "تعذر حذف الإعلان");
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={`الفعاليات والاختبارات (${comms.data?.events.length ?? 0})`} icon={CalendarDays}>
        {(comms.data?.events.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">لا توجد فعاليات.</p>
        ) : (
          <div className="divide-y">
            {comms.data?.events.map((ev) => (
              <div key={ev.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-semibold">{ev.title}</div>
                  <div className="text-xs text-muted-foreground" dir="ltr">
                    {EVENT_KIND_LABEL[ev.event_type]} · {new Date(ev.starts_at).toLocaleString("ar-EG")} ·{" "}
                    {ev.is_published ? "منشورة" : "مخفية"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await adminUpsertAcademicEvent({
                          data: {
                            id: ev.id,
                            title: ev.title,
                            description: ev.description ?? "",
                            event_type: ev.event_type,
                            starts_at: ev.starts_at,
                            ends_at: ev.ends_at,
                            location: ev.location ?? "",
                            audience_scope: ev.audience_scope,
                            program_id: ev.program_id,
                            level_id: ev.level_id,
                            target_student_user_id: ev.target_student_user_id,
                            is_published: !ev.is_published,
                          },
                        });
                        await refresh();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "تعذر التحديث");
                      }
                    }}
                  >
                    {ev.is_published ? "إخفاء" : "نشر"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={async () => {
                      try {
                        await adminDeleteAcademicEvent({ data: { id: ev.id } });
                        await refresh();
                        toast.success("تم حذف الفعالية");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "تعذر حذف الفعالية");
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
