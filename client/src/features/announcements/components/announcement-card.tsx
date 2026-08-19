import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Trash2, Calendar, Tag } from "lucide-react";
import { format } from "date-fns";
import { categoryColors } from "../lib/categories";

export function AnnouncementCard({ ann, canManage, onDelete }: {
  ann: any;
  canManage: boolean;
  onDelete: (id: string) => void;
}) {
  const catColor = categoryColors[ann.category] || categoryColors.general;
  const isUrgent = ann.priority === "urgent";
  const isExpired = ann.expiresAt && new Date(ann.expiresAt) < new Date();

  return (
    <Card
      className={`hover-elevate ${isUrgent ? "border-red-200 dark:border-red-800/30" : ""} ${isExpired ? "opacity-60" : ""}`}
      data-testid={`announcement-${ann.id}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isUrgent ? "bg-red-100 dark:bg-red-900/20" : "bg-primary/10"}`}>
              <Megaphone className={`h-5 w-5 ${isUrgent ? "text-red-600 dark:text-red-400" : "text-primary"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground leading-snug">{ann.title}</h3>
                <Badge className={`text-xs capitalize flex-shrink-0 ${catColor}`}>{ann.category}</Badge>
                {isUrgent && (
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-xs">Urgent</Badge>
                )}
                {isExpired && <Badge variant="outline" className="text-xs">Expired</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line leading-relaxed">{ann.content}</p>
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(ann.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </span>
                {ann.visibleTo && ann.visibleTo !== "all" && (
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    Visible to: {ann.visibleTo}
                  </span>
                )}
                {ann.expiresAt && (
                  <span>
                    Expires: {format(new Date(ann.expiresAt), "MMM d, yyyy")}
                  </span>
                )}
              </div>
            </div>
          </div>
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground flex-shrink-0"
              onClick={() => onDelete(ann.id)}
              data-testid={`button-delete-announcement-${ann.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
