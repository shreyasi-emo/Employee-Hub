import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, ExternalLink, Trash2 } from "lucide-react";
import { format } from "date-fns";

export function ResourcesHeader({ canManage, onUpload }: { canManage: boolean; onUpload: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Company Resources</h1>
          <p className="text-sm text-muted-foreground">Policies, the yearly calendar, quality docs</p>
        </div>
      </div>
      {canManage && <Button onClick={onUpload}><Plus className="h-4 w-4 mr-1" /> Upload</Button>}
    </div>
  );
}

export function DocumentList({ docs, canManage, onDelete }: {
  docs: any[]; canManage: boolean; onDelete: (id: string) => void;
}) {
  if (docs.length === 0) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Nothing here yet.</CardContent></Card>;
  }
  return (
    <>
      {docs.map((d: any) => (
        <Card key={d.id}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">{d.title}</h3>
                {d.year && <Badge variant="outline" className="mt-1">{d.year}</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <a href={d.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline"><ExternalLink className="h-4 w-4 mr-1" /> Open</Button>
                </a>
                {canManage && <Button size="icon" variant="ghost" onClick={() => onDelete(d.id)}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
            {d.summaryNote && <p className="text-sm text-muted-foreground">{d.summaryNote}</p>}
            <div className="text-xs text-muted-foreground">Uploaded {format(new Date(d.createdAt), "d MMM yyyy")}</div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
