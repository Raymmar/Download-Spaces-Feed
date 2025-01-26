import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Docs() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Feed
            </Button>
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-6">API Documentation</h1>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Webhook Endpoint</h2>
              <p className="text-muted-foreground mb-4">
                Send POST requests to this endpoint to submit webhook data:
              </p>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                POST /api/webhook
              </pre>

              <h3 className="text-lg font-semibold mt-6 mb-2">Request Body</h3>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`{
  "userId": "string",
  "playlistUrl": "string (URL)",
  "spaceName": "string",
  "tweetUrl": "string (URL)",
  "ip": "string",
  "city": "string",
  "region": "string",
  "country": "string"
}`}
              </pre>

              <h3 className="text-lg font-semibold mt-6 mb-2">Example Request</h3>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`curl -X POST http://localhost:5000/api/webhook \\
  -H "Content-Type: application/json" \\
  -d '{
    "userId": "e419c3ba-e440-4800-be4c-20edc8034ad6",
    "playlistUrl": "https://video.twimg.com/ext_tw_video/1883207419527933952/pu/pl/bQZsVOTKtxg5IIvl.m3u8",
    "spaceName": "Home / X",
    "tweetUrl": "https://x.com/i/spaces/1vAGROOkPLPJl/peek",
    "ip": "47.195.233.68",
    "city": "Sarasota",
    "region": "Florida",
    "country": "US"
  }'`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Additional Endpoints</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Get Webhooks</h3>
                  <pre className="bg-muted p-4 rounded-lg">GET /api/webhooks</pre>
                  <p className="mt-2 text-muted-foreground">
                    Returns the 100 most recent webhook submissions.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Server-Sent Events</h3>
                  <pre className="bg-muted p-4 rounded-lg">GET /api/events</pre>
                  <p className="mt-2 text-muted-foreground">
                    Opens an SSE connection for real-time webhook updates.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
