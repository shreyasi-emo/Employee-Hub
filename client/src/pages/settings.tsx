import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Eye, EyeOff, Lock, User, Phone, MapPin, UserCheck, Save } from "lucide-react";
import { getRoleLabel } from "@/lib/auth";

const pwSchema = z.object({
  currentPassword: z.string().min(1, "Current password required"),
  newPassword: z.string().min(8, "Must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

const profileSchema = z.object({
  phone: z.string().optional(),
  currentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
});

type PwForm = z.infer<typeof pwSchema>;
type ProfileForm = z.infer<typeof profileSchema>;

function ChangePasswordTab() {
  const { toast } = useToast();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const form = useForm<PwForm>({
    resolver: zodResolver(pwSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: PwForm) => apiRequest("PUT", "/api/auth/change-password", {
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    }),
    onSuccess: () => {
      toast({ title: "Password updated successfully" });
      form.reset();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Lock className="h-4 w-4" /> Change Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4 max-w-sm">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        {...field}
                        type={showCurrent ? "text" : "password"}
                        className="pl-9 pr-9"
                        placeholder="Enter current password"
                        data-testid="input-current-password"
                      />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowCurrent(!showCurrent)}>
                        {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        {...field}
                        type={showNew ? "text" : "password"}
                        className="pl-9 pr-9"
                        placeholder="Min 8 characters"
                        data-testid="input-new-password"
                      />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowNew(!showNew)}>
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="Re-enter new password"
                      data-testid="input-confirm-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-password">
              <Save className="h-4 w-4 mr-2" />
              {mutation.isPending ? "Saving..." : "Update Password"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function ProfileTab() {
  const { data: auth } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useQuery<any>({
    queryKey: ["/api/employees/me"],
    enabled: !!auth?.employee,
  });

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      phone: me?.phone || "",
      currentAddress: me?.currentAddress || "",
      permanentAddress: me?.permanentAddress || "",
      emergencyContactName: me?.emergencyContactName || "",
      emergencyContactPhone: me?.emergencyContactPhone || "",
      emergencyContactRelation: me?.emergencyContactRelation || "",
    },
    values: {
      phone: me?.phone || "",
      currentAddress: me?.currentAddress || "",
      permanentAddress: me?.permanentAddress || "",
      emergencyContactName: me?.emergencyContactName || "",
      emergencyContactPhone: me?.emergencyContactPhone || "",
      emergencyContactRelation: me?.emergencyContactRelation || "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: ProfileForm) => apiRequest("PUT", "/api/employees/me", data),
    onSuccess: () => {
      toast({ title: "Profile updated" });
      qc.invalidateQueries({ queryKey: ["/api/employees/me"] });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!auth?.employee) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No linked employee record. Contact your HR administrator.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4" /> Update Personal Details
        </CardTitle>
        <p className="text-xs text-muted-foreground">You can update your contact info and emergency contact details.</p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-5 max-w-lg">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Contact
              </p>
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+91 98765 43210" data-testid="input-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Address
              </p>
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="currentAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Address</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Flat, Street, City, State, PIN" data-testid="input-current-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="permanentAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Permanent Address</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Permanent home address" data-testid="input-permanent-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5" /> Emergency Contact
              </p>
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="emergencyContactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Contact name" data-testid="input-emergency-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="emergencyContactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="+91 98765 43210" data-testid="input-emergency-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="emergencyContactRelation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Relation</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. Spouse, Parent" data-testid="input-emergency-relation" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-profile">
              <Save className="h-4 w-4 mr-2" />
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const emp = auth?.employee;

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    invited: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    suspended: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    exited: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your password, profile, and preferences</p>
      </div>

      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-primary-foreground font-bold text-lg">
              {emp ? `${emp.firstName[0]}${emp.lastName[0]}` : user?.username?.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {emp ? `${emp.firstName} ${emp.lastName}` : user?.username}
            </p>
            <p className="text-xs text-muted-foreground">@{user?.username}</p>
            {emp && <p className="text-xs text-muted-foreground">{emp.email}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${statusColors[(user as any)?.accountStatus || "active"]}`} data-testid="badge-account-status">
              {(user as any)?.accountStatus || "active"}
            </Badge>
            <Badge variant="outline" className="text-xs" data-testid="badge-role">
              {getRoleLabel(user?.role as any)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="password">
        <TabsList>
          <TabsTrigger value="password" data-testid="tab-settings-password">Password</TabsTrigger>
          {emp && <TabsTrigger value="profile" data-testid="tab-settings-profile">Personal Info</TabsTrigger>}
        </TabsList>
        <TabsContent value="password" className="mt-4">
          <ChangePasswordTab />
        </TabsContent>
        {emp && (
          <TabsContent value="profile" className="mt-4">
            <ProfileTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
