import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Paperclip, FileText, X, Download } from "lucide-react";

export type UploadedFile = { fileName: string; fileType: string; fileData: string };

const isImage = (t?: string) => !!t && /^image\//.test(t);

// Single-file upload → base64 data-URL (the app's only attachment mechanism; mirrors the reimbursement receipt).
export function FileUpload({ value, onChange, label = "Upload file", accept = "image/jpeg,image/png,application/pdf", maxMB = 5, disabled }: {
  value?: UploadedFile | null;
  onChange: (f: UploadedFile | null) => void;
  label?: string;
  accept?: string;
  maxMB?: number;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const onFile = (file?: File) => {
    if (!file) return;
    if (file.size > maxMB * 1024 * 1024) { toast({ title: `File too large (max ${maxMB} MB)`, variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = () => onChange({ fileName: file.name, fileType: file.type, fileData: String(reader.result) });
    reader.readAsDataURL(file);
  };
  if (value?.fileData) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
        {isImage(value.fileType)
          ? <img src={value.fileData} alt="" className="h-9 w-9 rounded object-cover flex-shrink-0" />
          : <span className="h-9 w-9 rounded bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><FileText className="h-4 w-4" /></span>}
        <span className="text-sm text-foreground truncate flex-1 min-w-0">{value.fileName}</span>
        <a href={value.fileData} download={value.fileName} className="text-muted-foreground hover:text-[#206295]" aria-label="Download"><Download className="h-4 w-4" /></a>
        {!disabled && <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-[#FF6F62]" onClick={() => onChange(null)} aria-label="Remove"><X className="h-4 w-4" /></Button>}
      </div>
    );
  }
  return (
    <>
      <input ref={ref} type="file" accept={accept} className="hidden" disabled={disabled} onChange={(e) => onFile(e.target.files?.[0])} />
      <Button type="button" variant="secondary" size="sm" className="w-full" disabled={disabled} onClick={() => ref.current?.click()}><Paperclip className="h-4 w-4 mr-1.5" /> {label}</Button>
    </>
  );
}
