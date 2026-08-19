import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountSummaryCard } from "../components/account-summary-card";
import { ChangePasswordTab } from "../components/change-password-tab";
import { ProfileTab } from "../components/profile-tab";

export default function SettingsPage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const emp = auth?.employee;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your password, profile, and preferences</p>
      </div>

      <AccountSummaryCard user={user} emp={emp} />

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
