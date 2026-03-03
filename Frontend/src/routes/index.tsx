import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GoogleLogo, FileText, Lightning, Robot } from "@phosphor-icons/react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: "/dashboard" });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleSignIn = () => {
    signIn("google", { redirectTo: `${window.location.origin}/dashboard` });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" weight="duotone" />
            <span className="text-xl font-bold">MeetingsToDocument</span>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-16 flex flex-col items-center justify-center">
        <div className="max-w-3xl text-center space-y-8">
          <h1 className="text-5xl font-bold tracking-tight">
            Transform Meeting Recordings into{" "}
            <span className="text-primary">Professional Documents</span>
          </h1>
          
          <p className="text-xl text-muted-foreground">
            AI-powered document generation from your Google Drive meeting recordings.
            Get structured Zuora Solution Design Documents in minutes, not hours.
          </p>

          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Get Started</CardTitle>
              <CardDescription>
                Sign in with your Google Workspace account to access your Drive files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                size="lg" 
                className="w-full gap-2" 
                disabled={isLoading}
                onClick={handleSignIn}
              >
                <GoogleLogo weight="bold" className="h-5 w-5" />
                {isLoading ? "Loading..." : "Sign in with Google"}
              </Button>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-6 pt-8">
            <FeatureCard
              icon={<Lightning weight="duotone" className="h-8 w-8 text-primary" />}
              title="Fast Processing"
              description="Upload your meeting recordings and get documents in minutes"
            />
            <FeatureCard
              icon={<Robot weight="duotone" className="h-8 w-8 text-primary" />}
              title="AI-Powered"
              description="Advanced AI extracts key information and generates professional content"
            />
            <FeatureCard
              icon={<FileText weight="duotone" className="h-8 w-8 text-primary" />}
              title="Zuora Ready"
              description="Output follows Zuora Q2R Requirements document structure"
            />
          </div>
        </div>
      </main>

      <footer className="border-t py-6 bg-background/80">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          MeetingsToDocument &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <Card className="text-left">
      <CardContent className="pt-6">
        <div className="mb-4">{icon}</div>
        <h3 className="font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
