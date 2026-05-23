"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResetPassword } from "@/hooks/useAuth";
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@/lib/validators";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingCard />}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function LoadingCard() {
  return (
    <Card className="gap-6 p-6">
      <CardContent className="px-0 text-sm text-muted-foreground">
        Loading…
      </CardContent>
    </Card>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const reset = useResetPassword();
  const [tokenInvalid, setTokenInvalid] = useState(false);

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onTouched",
    defaultValues: { password: "", confirmPassword: "" },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  if (!token) {
    return (
      <Card className="gap-6 p-6">
        <CardHeader className="px-0">
          <CardTitle className="text-lg">Invalid link</CardTitle>
          <CardDescription>
            The reset token is missing from the link. Request a new email.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-0">
          <Link href="/forgot-password" className={buttonVariants({ size: "lg" })}>
            Request a new email
          </Link>
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

  if (tokenInvalid) {
    return (
      <Card className="gap-6 p-6">
        <CardHeader className="px-0">
          <CardTitle className="text-lg">Token is invalid</CardTitle>
          <CardDescription>
            The link is expired or has already been used. Request a new one.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-0">
          <Link href="/forgot-password" className={buttonVariants({ size: "lg" })}>
            Request a new email
          </Link>
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

  const onSubmit = (values: ResetPasswordValues) => {
    reset.mutate(
      { token, password: values.password },
      {
        onSuccess: () => {
          toast.success("Password updated. Sign in with the new password.");
          router.replace("/sign-in");
        },
        onError: (error) => {
          if (
            error.status === 400 &&
            /token|expired|invalid/i.test(error.message)
          ) {
            setTokenInvalid(true);
            return;
          }
          toast.error(error.message || "Couldn't update password");
        },
      },
    );
  };

  const submitting = isSubmitting || reset.isPending;

  return (
    <Card className="gap-6 p-6">
      <CardHeader className="px-0">
        <CardTitle className="text-lg">New password</CardTitle>
        <CardDescription>
          Enter and confirm a new password. After saving we&apos;ll send you to Sign in.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={submitting} className="mt-2 h-9">
            {submitting ? "Saving…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
