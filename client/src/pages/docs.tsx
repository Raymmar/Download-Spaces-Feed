import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Docs() {
  // Get the current hostname from window.location
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

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

        <h1 className="text-3xl font-bold mb-6">Download Twitter Spaces Activity Feed</h1>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">About this feed</h2>
              <p className="text-muted-foreground mb-4">
                This website displays a live feed of every x.com (formerly Twitter) Space that has been downloaded using the Download Twitter Spaces Chrome Extension. Learn more about the extension <a href="https://chrome.google.com/webstore/detail/download-twitter/">here.</a> 
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}