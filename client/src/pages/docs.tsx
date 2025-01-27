import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Docs() {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-[700px]">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h1 className="mb-6 text-2xl font-bold">
                Webhook Receiver Documentation
              </h1>
              <p className="mb-4 text-muted-foreground">
                This application provides a simple interface for receiving and
                displaying webhook data. Any POST request sent to{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  {baseUrl}/api/webhook
                </code>{" "}
                will be displayed on the main dashboard in real-time.
              </p>
              <h2 className="mt-8 text-xl font-semibold">Example Usage</h2>
              <pre className="mt-4 rounded-lg bg-muted p-4">
                {`curl -X POST ${baseUrl}/api/webhook \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello from webhook!"}'`}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}