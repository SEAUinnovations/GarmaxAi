import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, ArrowLeft } from "lucide-react";

export default function PaymentCancel() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <Card className="max-w-md w-full border-white/10 bg-card">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <XCircle className="w-10 h-10 text-yellow-500" />
          </div>
          <CardTitle className="text-3xl font-bold">Payment Cancelled</CardTitle>
          <CardDescription>
            Your payment was cancelled. No charges were made to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              If you experienced any issues during checkout, please contact our support team.
            </p>
            
            <div className="flex flex-col gap-3">
              <Link href="/pricing">
                <Button className="w-full" size="lg">
                  <ArrowLeft className="mr-2 w-4 h-4" />
                  Back to Pricing
                </Button>
              </Link>
              
              <Link href="/dashboard">
                <Button variant="outline" className="w-full">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
