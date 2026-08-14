import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";
import { format } from "date-fns";

export type ThreadComment = { id: string; authorId: string; authorName: string; authorRole?: string; body: string; at: string; kind?: string };

// CEO ⇄ HR/requester discussion thread. Self-contained: posts to `${basePath}/${id}/comment` and
// refreshes the owning list query (invalidateKey). Reused by the CEO review modal, detail dialogs and HR side.
export function CommentThread({ basePath, id, comments = [], invalidateKey, meId, canPost = true }: {
  basePath: string; id: string; comments?: ThreadComment[]; invalidateKey: string; meId?: string; canPost?: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const send = useMutation({
    mutationFn: () => apiRequest("POST", `${basePath}/${id}/comment`, { body: body.trim() }),
    onSuccess: () => { setBody(""); qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith(invalidateKey) }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  return (
    <div className="space-y-2">
      {comments.length === 0
        ? <p className="text-xs text-muted-foreground">No messages yet.</p>
        : comments.map((c) => (
            <div key={c.id} className={`rounded-lg px-3 py-2 ${c.authorId === meId ? "bg-[#206295]/10" : "bg-muted/50"}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-foreground">{c.authorName}</span>
                {c.kind === "query" && <span className="text-[10px] font-semibold text-[#D98324] bg-[#FFA962]/25 px-1.5 py-0.5 rounded">Query</span>}
                <span className="text-[10px] text-muted-foreground ml-auto">{c.at ? format(new Date(c.at), "d MMM, h:mm a") : ""}</span>
              </div>
              <p className="text-[13px] text-foreground whitespace-pre-wrap break-words">{c.body}</p>
            </div>
          ))}
      {canPost && (
        <div className="flex items-end gap-2 pt-0.5">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={1} placeholder="Write a reply…" className="resize-none min-h-9" />
          <Button size="icon" className="btn-primary-gradient h-9 w-9 flex-shrink-0" disabled={!body.trim() || send.isPending} onClick={() => send.mutate()} aria-label="Send reply"><Send className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}
