import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Edit, Save } from "lucide-react";

export function StatutorySection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: configs = [] } = useQuery<any[]>({ queryKey: ["/api/statutory-config"] });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/statutory-config", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/statutory-config"] });
      toast({ title: "Config updated" });
      setEditingKey(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      {configs.map((cfg: any) => (
        <Card key={cfg.key}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{cfg.key.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
              {cfg.description && <p className="text-xs text-muted-foreground">{cfg.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              {editingKey === cfg.key ? (
                <>
                  <Input
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="w-24 h-8 text-sm"
                    data-testid={`input-config-${cfg.key}`}
                  />
                  <Button
                    size="sm"
                    onClick={() => mutation.mutate({ key: cfg.key, value: editValue })}
                    disabled={mutation.isPending}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingKey(null)}>Cancel</Button>
                </>
              ) : (
                <>
                  <span className="text-sm font-mono text-foreground px-2 py-1 rounded bg-muted">{cfg.value}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => { setEditingKey(cfg.key); setEditValue(cfg.value); }}
                    data-testid={`button-edit-config-${cfg.key}`}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
