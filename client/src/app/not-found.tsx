import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-8xl font-black text-muted-foreground/20 select-none">404</div>
        <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
        <p className="text-muted-foreground text-sm">The page you're looking for doesn't exist or you don't have access to it.</p>
        <div className="flex gap-3 justify-center pt-2">
          <Button variant="outline" onClick={() => history.back()} data-testid="button-go-back">
            <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
          </Button>
          <Button onClick={() => navigate("/")} data-testid="button-go-home">
            <Home className="h-4 w-4 mr-2" /> Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
