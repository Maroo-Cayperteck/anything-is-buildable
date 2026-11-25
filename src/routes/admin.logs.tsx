import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { History, Loader2 } from "lucide-react";
import { Card } from "@/components/portal/Shell";
import { Button } from "@/components/ui/button";
import { listAdminActivityLogs } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/logs")({
  component: AdminLogsPage,
});

function AdminLogsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-logs", page],
    queryFn: () => listAdminActivityLogs({ data: { page, pageSize: 30 } }),
  });

  if (isLoading) {
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return <div className="rounded-xl border bg-card p-8 text-center text-destructive">تعذر تحميل سجل النشاط.</div>;
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <Card title={`سجل نشاط المسؤولين (${data.total})`} icon={History}>
      {data.items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">لا توجد سجلات نشاط بعد.</p>
      ) : (
        <div className="-m-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="label-caps">
                <th className="p-4 text-right">العملية</th>
                <th className="p-4 text-right">الجدول / الكيان</th>
                <th className="p-4 text-right">المنفذ</th>
                <th className="p-4 text-right">التفاصيل</th>
                <th className="p-4 text-right">التوقيت</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="p-4 font-mono text-xs font-semibold text-primary">{log.action}</td>
                  <td className="p-4 text-xs">{log.entity_type}</td>
                  <td className="p-4 text-xs">{log.actor_label || "—"}</td>
                  <td className="p-4 font-mono text-xs text-muted-foreground" dir="ltr">
                    {JSON.stringify(log.metadata ?? {})}
                  </td>
                  <td className="p-4 font-mono text-xs text-muted-foreground" dir="ltr">
                    {new Date(log.created_at).toLocaleString("ar-EG")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            السابق
          </Button>
          <span className="text-xs text-muted-foreground">
            صفحة {page} من {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            التالي
          </Button>
        </div>
      )}
    </Card>
  );
}
