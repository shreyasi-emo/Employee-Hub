import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { User, Phone, MapPin, UserCheck, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { profileSchema, type ProfileForm } from "../lib/schemas";
import { useMyEmployeeRecord, useUpdateMyProfile } from "../api/settings.api";

export function ProfileTab() {
  const { data: auth } = useAuth();
  const { toast } = useToast();
  const { data: me } = useMyEmployeeRecord(!!auth?.employee);

  const fields: ProfileForm = {
    phone: me?.phone || "",
    currentAddress: me?.currentAddress || "",
    permanentAddress: me?.permanentAddress || "",
    emergencyContactName: me?.emergencyContactName || "",
    emergencyContactPhone: me?.emergencyContactPhone || "",
    emergencyContactRelation: me?.emergencyContactRelation || "",
  };

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: fields,
    values: fields,
  });

  const mutation = useUpdateMyProfile({
    onSuccess: () => toast({ title: "Profile updated" }),
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
                      <Input {...field} type="tel" inputMode="tel" placeholder="+91 98765 43210" data-testid="input-phone" />
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
                          <Input {...field} type="tel" inputMode="tel" placeholder="+91 98765 43210" data-testid="input-emergency-phone" />
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
