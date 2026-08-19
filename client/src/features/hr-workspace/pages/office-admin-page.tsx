import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { DateInput } from "@/components/shared/datetime-field";
import { Plus, Building2, ShoppingCart, CreditCard, Send } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pending_ceo: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  requested: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  ordered: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  received: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  closed: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function formatStatus(s: string) { return s?.replace(/_/g, " ") || ""; }
function formatDate(d: string) { try { return format(new Date(d), "MMM d, yyyy"); } catch { return ""; } }

export default function OfficeAdminPage() {
  const { data: auth } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState("vendors");
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [showPRForm, setShowPRForm] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: vendors = [], isLoading: loadingVendors } = useQuery<any[]>({ queryKey: ["/api/workspace/vendors"] });
  const { data: purchaseRequests = [], isLoading: loadingPRs } = useQuery<any[]>({
    queryKey: ["/api/workspace/purchase-requests", statusFilter],
    queryFn: () => apiRequest("GET", statusFilter !== "all" ? `/api/workspace/purchase-requests?status=${statusFilter}` : "/api/workspace/purchase-requests"),
  });
  const { data: payments = [], isLoading: loadingPayments } = useQuery<any[]>({
    queryKey: ["/api/workspace/payments", statusFilter],
    queryFn: () => apiRequest("GET", statusFilter !== "all" ? `/api/workspace/payments?status=${statusFilter}` : "/api/workspace/payments"),
  });

  // Forms — use correct DB field names
  const vendorForm = useForm({ defaultValues: { name: "", category: "supplier", contactName: "", email: "", phone: "", gstNumber: "", panNumber: "" } });
  const prForm = useForm({ defaultValues: { category: "office_supplies", notes: "", estimatedCost: "", neededByDate: "" } });
  const payForm = useForm({ defaultValues: { vendorId: "", paymentType: "vendor_payment", amount: "", currency: "INR", description: "" } });

  const createVendorMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/workspace/vendors", { ...data, isActive: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/workspace/vendors"] }); setShowVendorForm(false); vendorForm.reset(); toast({ title: "Vendor added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createPRMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/workspace/purchase-requests", {
      category: data.category,
      items: [],
      estimatedCost: data.estimatedCost ? String(data.estimatedCost) : null,
      neededByDate: data.neededByDate || null,
      notes: data.notes || null,
      status: "draft",
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/workspace/purchase-requests"] }); setShowPRForm(false); prForm.reset(); toast({ title: "Purchase request created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitPRMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/workspace/purchase-requests/${id}/submit`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/workspace/purchase-requests"] }); toast({ title: "Submitted for CEO approval" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updatePRMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiRequest("PUT", `/api/workspace/purchase-requests/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/workspace/purchase-requests"] }),
  });

  const createPayMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/workspace/payments", { ...data, amount: Number(data.amount), status: "requested" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/workspace/payments"] }); setShowPayForm(false); payForm.reset(); toast({ title: "Payment created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitPayMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/workspace/payments/${id}/submit`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/workspace/payments"] }); toast({ title: "Submitted for CEO approval" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filterControls = (
    <Select value={statusFilter} onValueChange={setStatusFilter}>
      <SelectTrigger className="w-40" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Status</SelectItem>
        <SelectItem value="draft">Draft</SelectItem>
        <SelectItem value="pending_ceo">Pending CEO</SelectItem>
        <SelectItem value="approved">Approved</SelectItem>
        <SelectItem value="rejected">Rejected</SelectItem>
        <SelectItem value="completed">Completed</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" /> Office Admin Ops
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Process approved requests, manage vendors and payments</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} data-testid="tabs-office">
        <TabsList>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="purchase">Purchase Requests</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        {/* VENDORS */}
        <TabsContent value="vendors" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowVendorForm(true)} data-testid="button-new-vendor">
              <Plus className="h-4 w-4 mr-1.5" /> Add Vendor
            </Button>
          </div>
          {loadingVendors ? <Skeleton className="h-24 w-full" /> : (
            <div className="space-y-2">
              {(vendors as any[]).map((v: any) => (
                <Card key={v.id} data-testid={`card-vendor-${v.id}`}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm text-foreground">{v.name}</span>
                        <Badge className={`text-xs border-0 ${v.isActive ? STATUS_COLORS.active : STATUS_COLORS.rejected}`}>{v.isActive ? "Active" : "Inactive"}</Badge>
                        <Badge variant="outline" className="text-xs capitalize">{v.category}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{v.contactName && `${v.contactName} · `}{v.email && `${v.email} · `}{v.phone}</p>
                      {v.gstNumber && <p className="text-xs text-muted-foreground">GST: {v.gstNumber}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(vendors as any[]).length === 0 && <Card className="py-10"><CardContent className="text-center text-muted-foreground text-sm">No vendors yet.</CardContent></Card>}
            </div>
          )}
        </TabsContent>

        {/* PURCHASE REQUESTS — ALL (Admin view) */}
        <TabsContent value="purchase" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            {filterControls}
            <Button size="sm" onClick={() => setShowPRForm(true)} data-testid="button-new-pr">
              <Plus className="h-4 w-4 mr-1.5" /> New Request
            </Button>
          </div>
          {loadingPRs ? <Skeleton className="h-24 w-full" /> : (
            <div className="space-y-3">
              {(purchaseRequests as any[]).map((pr: any) => (
                <Card key={pr.id} data-testid={`card-pr-${pr.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <ShoppingCart className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="font-medium text-sm text-foreground capitalize">{pr.category?.replace(/_/g, " ")}</span>
                          <Badge className={`text-xs border-0 ${STATUS_COLORS[pr.status] || STATUS_COLORS.draft}`}>{formatStatus(pr.status)}</Badge>
                        </div>
                        {pr.notes && <p className="text-xs text-muted-foreground">{pr.notes}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {pr.estimatedCost && `Estimated: ₹${Number(pr.estimatedCost).toLocaleString()}`}
                          {pr.neededByDate && ` · Needed by ${formatDate(pr.neededByDate)}`}
                        </p>
                        {Array.isArray(pr.items) && pr.items.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {pr.items.slice(0, 3).map((item: any, i: number) => (
                              <div key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-muted-foreground flex-shrink-0" />
                                {item.description} {item.qty > 1 && `× ${item.qty}`}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                        {pr.status === "draft" && (
                          <Button variant="outline" size="sm" onClick={() => submitPRMutation.mutate(pr.id)} data-testid={`button-submit-pr-${pr.id}`}>
                            <Send className="h-3.5 w-3.5 mr-1.5" /> Submit
                          </Button>
                        )}
                        {pr.status === "approved" && (
                          <Button size="sm" onClick={() => updatePRMutation.mutate({ id: pr.id, status: "ordered" })} data-testid={`button-order-pr-${pr.id}`}>
                            Mark Ordered
                          </Button>
                        )}
                        {pr.status === "ordered" && (
                          <Button size="sm" variant="outline" onClick={() => updatePRMutation.mutate({ id: pr.id, status: "received" })} data-testid={`button-receive-pr-${pr.id}`}>
                            Mark Received
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(purchaseRequests as any[]).length === 0 && <Card className="py-10"><CardContent className="text-center text-muted-foreground text-sm">No purchase requests.</CardContent></Card>}
            </div>
          )}
        </TabsContent>

        {/* PAYMENTS */}
        <TabsContent value="payments" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            {filterControls}
            <Button size="sm" onClick={() => setShowPayForm(true)} data-testid="button-new-payment">
              <Plus className="h-4 w-4 mr-1.5" /> New Payment
            </Button>
          </div>
          {loadingPayments ? <Skeleton className="h-24 w-full" /> : (
            <div className="space-y-3">
              {(payments as any[]).map((pay: any) => (
                <Card key={pay.id} data-testid={`card-payment-${pay.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <CreditCard className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="font-medium text-sm text-foreground capitalize">{pay.paymentType?.replace(/_/g, " ")}</span>
                          <Badge className={`text-xs border-0 ${STATUS_COLORS[pay.status] || STATUS_COLORS.requested}`}>{formatStatus(pay.status)}</Badge>
                        </div>
                        {pay.description && <p className="text-xs text-muted-foreground">{pay.description}</p>}
                        <p className="text-xs font-semibold text-foreground mt-0.5">{pay.currency} {Number(pay.amount).toLocaleString()}</p>
                      </div>
                      {pay.status === "requested" && (
                        <Button variant="outline" size="sm" onClick={() => submitPayMutation.mutate(pay.id)} data-testid={`button-submit-pay-${pay.id}`}>
                          <Send className="h-3.5 w-3.5 mr-1.5" /> Submit
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(payments as any[]).length === 0 && <Card className="py-10"><CardContent className="text-center text-muted-foreground text-sm">No payments yet.</CardContent></Card>}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Vendor Dialog */}
      <Dialog open={showVendorForm} onOpenChange={setShowVendorForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Vendor</DialogTitle></DialogHeader>
          <form onSubmit={vendorForm.handleSubmit(data => createVendorMutation.mutate(data))} className="space-y-4">
            <div className="space-y-1.5"><Label>Vendor Name *</Label><Input {...vendorForm.register("name", { required: true })} data-testid="input-vendor-name" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={vendorForm.watch("category")} onValueChange={v => vendorForm.setValue("category", v)}>
                  <SelectTrigger data-testid="select-vendor-cat"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supplier">Supplier</SelectItem>
                    <SelectItem value="service_provider">Service Provider</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="consultant">Consultant</SelectItem>
                    <SelectItem value="travel_agency">Travel Agency</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Contact Name</Label><Input {...vendorForm.register("contactName")} data-testid="input-vendor-contact" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" {...vendorForm.register("email")} data-testid="input-vendor-email" /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input {...vendorForm.register("phone")} data-testid="input-vendor-phone" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>GST Number</Label><Input {...vendorForm.register("gstNumber")} data-testid="input-vendor-gst" /></div>
              <div className="space-y-1.5"><Label>PAN Number</Label><Input {...vendorForm.register("panNumber")} data-testid="input-vendor-pan" /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowVendorForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createVendorMutation.isPending} data-testid="button-save-vendor">
                {createVendorMutation.isPending ? "Adding..." : "Add Vendor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Purchase Request Dialog */}
      <Dialog open={showPRForm} onOpenChange={setShowPRForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Purchase Request</DialogTitle></DialogHeader>
          <form onSubmit={prForm.handleSubmit(data => createPRMutation.mutate(data))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={prForm.watch("category")} onValueChange={v => prForm.setValue("category", v)}>
                <SelectTrigger data-testid="select-pr-cat"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="office_supplies">Office Supplies</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="software">Software</SelectItem>
                  <SelectItem value="it_hardware">IT Hardware</SelectItem>
                  <SelectItem value="furniture">Furniture</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Description / Notes *</Label><Textarea rows={2} {...prForm.register("notes", { required: true })} data-testid="textarea-pr-notes" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Estimated Cost (₹)</Label><Input type="number" min="0" {...prForm.register("estimatedCost")} data-testid="input-pr-cost" /></div>
              <div className="space-y-1.5"><Label>Needed By</Label><Controller control={prForm.control} name="neededByDate" render={({ field }) => <DateInput value={field.value || ""} onChange={field.onChange} testId="input-pr-needed" />} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPRForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createPRMutation.isPending} data-testid="button-save-pr">
                {createPRMutation.isPending ? "Creating..." : "Create Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPayForm} onOpenChange={setShowPayForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Payment Request</DialogTitle></DialogHeader>
          <form onSubmit={payForm.handleSubmit(data => createPayMutation.mutate(data))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Payment Type</Label>
              <Select value={payForm.watch("paymentType")} onValueChange={v => payForm.setValue("paymentType", v)}>
                <SelectTrigger data-testid="select-pay-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendor_payment">Vendor Payment</SelectItem>
                  <SelectItem value="reimbursement">Reimbursement</SelectItem>
                  <SelectItem value="advance">Advance</SelectItem>
                  <SelectItem value="utility">Utility</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vendor</Label>
              <Select value={payForm.watch("vendorId")} onValueChange={v => payForm.setValue("vendorId", v)}>
                <SelectTrigger data-testid="select-pay-vendor"><SelectValue placeholder="Select vendor..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(vendors as any[]).map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount *</Label><Input type="number" min="0" {...payForm.register("amount", { required: true })} data-testid="input-pay-amount" /></div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={payForm.watch("currency")} onValueChange={v => payForm.setValue("currency", v)}>
                  <SelectTrigger data-testid="select-pay-currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} {...payForm.register("description")} data-testid="textarea-pay-desc" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPayForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createPayMutation.isPending} data-testid="button-save-payment">
                {createPayMutation.isPending ? "Creating..." : "Create Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
