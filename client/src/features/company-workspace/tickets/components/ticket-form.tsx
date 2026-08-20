import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequestDialog } from "@/components/shared/request-dialog";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";
import { cap } from "../../shared/approval-format";
import { ERR_BORDER, FieldError } from "../../components/request-ui";
import { TICKET_CATEGORIES } from "../lib/ticket-categories";
import { useCreateTicket } from "../api/tickets.api";

const BLANK = { category: "hr_query", subject: "", description: "", priority: "medium" };
// The footer lives outside the <form>, so the submit button is bound back to it by id.
const FORM_ID = "support-ticket-form";

// The one Support Ticket form, used by both Company Workspace and My Requests. It used to be
// two hand-written copies, which is how they drifted: only one showed the "Subject is required"
// error, only one offered "Save as Draft", and each carried its own category list.
//
// `onSaveDraft` follows the same convention as the purchase / travel / reimbursement dialogs —
// the button appears only when a caller passes it, so a screen with nowhere to keep drafts
// does not offer one.
export function TicketForm({ open, onClose, onSaveDraft, initialData, onSubmitted, autoValidate }: {
  open: boolean;
  onClose: () => void;
  onSaveDraft?: (data: any) => void;
  initialData?: any;
  onSubmitted?: () => void;
  /** Show the required-field errors as soon as the form opens — used when submitting an
   *  incomplete draft, so the reason it could not be submitted is visible immediately. */
  autoValidate?: boolean;
}) {
  const { toast } = useToast();
  const form = useForm({ defaultValues: BLANK });
  const errors = form.formState.errors as any;

  // Opening from a saved draft prefills; opening fresh clears whatever the last visit left.
  useEffect(() => {
    if (!open) return;
    form.reset({ ...BLANK, ...(initialData || {}) });
    if (autoValidate) setTimeout(() => form.trigger(), 0);
  }, [open]);

  const mutation = useCreateTicket({
    onSuccess: () => { toast({ title: "Ticket submitted successfully" }); onSubmitted?.(); close(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Cancel / X discards input (fresh form next open).
  function close() { form.reset(BLANK); onClose(); }

  return (
    <RequestDialog
      open={open}
      onClose={close}
      title="Raise Support Ticket"
      size="md"
      footer={<>
        <Button type="button" variant="outline" onClick={close}>Cancel</Button>
        {onSaveDraft && (
          <Button type="button" variant="secondary" className="btn-glass text-[#206295]" onClick={() => { onSaveDraft(form.getValues()); close(); }} data-testid="button-draft-ticket">
            <Save className="h-4 w-4 mr-1.5" /> Save as Draft
          </Button>
        )}
        {/* Outside the <form> now, so it is bound back to it by id. */}
        <Button type="submit" form={FORM_ID} disabled={mutation.isPending} data-testid="button-submit-ticket">
          {mutation.isPending ? "Submitting…" : "Submit Ticket"}
        </Button>
      </>}
    >
      <form id={FORM_ID} onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4 px-6 pt-2 pb-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Category</Label>
            <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v)}>
              <SelectTrigger data-testid="select-ticket-cat"><SelectValue /></SelectTrigger>
              <SelectContent>{TICKET_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{cap(c)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Priority</Label>
            <Select value={form.watch("priority")} onValueChange={(v) => form.setValue("priority", v)}>
              <SelectTrigger data-testid="select-ticket-pri"><SelectValue /></SelectTrigger>
              <SelectContent>{["low", "medium", "high", "critical"].map((c) => <SelectItem key={c} value={c}>{cap(c)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Subject *</Label>
          <Input {...form.register("subject", { required: true })} placeholder="Brief subject…" className={errors.subject ? ERR_BORDER : ""} data-testid="input-ticket-subject" />
          <FieldError show={errors.subject} msg="Subject is required" />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea rows={3} {...form.register("description")} placeholder="Describe your issue in detail…" data-testid="textarea-ticket-desc" />
        </div>
      </form>
    </RequestDialog>
  );
}
