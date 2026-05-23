"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForgotPassword } from "@/hooks/useAuth";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "@/lib/validators";

const COOLDOWN_SECONDS = 30;

export default function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => {
      setCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  const onSubmit = (values: ForgotPasswordValues) => {
    forgot.mutate(values, {
      onSuccess: () => {
        setSubmittedEmail(values.email);
        setCooldown(COOLDOWN_SECONDS);
      },
      onError: (error) => {
        toast.error(error.message || "Couldn't send the email");
      },
    });
  };

  const submitting = isSubmitting || forgot.isPending;

  if (submittedEmail) {
    return (
      <Card className="gap-6 p-6">
        <CardHeader className="px-0">
          <CardTitle className="text-lg">Check your email</CardTitle>
          <CardDescription>
            If an account with <span className="font-medium text-foreground">{submittedEmail}</span>{" "}
            exists — we&apos;ve sent a password reset link. It may take a few minutes to arrive.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-0">
          <Button
            variant="outline"
            disabled={cooldown > 0 || submitting}
            onClick={() => {
              forgot.mutate(
                { email: submittedEmail },
                {
                  onSuccess: () => {
                    setCooldown(COOLDOWN_SECONDS);
                    toast.success("Email resent");
                  },
                  onError: (error) => {
                    toast.error(error.message || "Couldn't send the email");
                  },
                },
              );
            }}
          >
            {cooldown > 0 ? `Resend in ${cooldown} s` : "Resend"}
          </Button>
          <Link
            href="/sign-in"
            className="text-center text-xs text-muted-foreground hover:underline"
          >
            Back to Sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-6 p-6">
      <CardHeader className="px-0">
        <CardTitle className="text-lg">Forgot password</CardTitle>
        <CardDescription>
          Enter your email — we&apos;ll send a password reset link.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <Button type="submit" disabled={submitting} className="mt-2 h-9">
            {submitting ? "Sending…" : "Send link"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Remembered your password?{" "}
          <Link href="/sign-in" className="text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
