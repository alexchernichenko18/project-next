"use client";

import * as Sentry from "@sentry/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { clearToken, setToken } from "@/lib/tokens";
import type { AuthResponse, Me } from "@/lib/types";

export const meQueryKey = ["me"] as const;

export function useMe() {
  const query = useQuery<Me, ApiError>({
    queryKey: meQueryKey,
    queryFn: () => apiFetch<Me>("/auth/me"),
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Tag every Sentry event with the current user (cleared on sign-out via
  // useSignOut). Keeps issues / replays attributable in the dashboard.
  useEffect(() => {
    if (!query.data) return;
    Sentry.setUser({
      id: query.data.userId,
      email: query.data.email,
    });
  }, [query.data]);

  return query;
}

type SignInInput = { email: string; password: string };
type SignUpInput = { email: string; password: string; name?: string };

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation<AuthResponse, ApiError, SignInInput>({
    mutationFn: (input) =>
      apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: input,
        auth: false,
      }),
    onSuccess: (data) => {
      setToken(data.accessToken);
      qc.invalidateQueries({ queryKey: meQueryKey });
    },
  });
}

type GoogleSignInInput = { idToken: string };

export function useGoogleSignIn() {
  const qc = useQueryClient();
  return useMutation<AuthResponse, ApiError, GoogleSignInInput>({
    mutationFn: (input) =>
      apiFetch<AuthResponse>("/auth/google", {
        method: "POST",
        body: { idToken: input.idToken },
        auth: false,
      }),
    onSuccess: (data) => {
      setToken(data.accessToken);
      qc.invalidateQueries({ queryKey: meQueryKey });
    },
  });
}

export function useSignUp() {
  const qc = useQueryClient();
  return useMutation<AuthResponse, ApiError, SignUpInput>({
    mutationFn: (input) => {
      const body: SignUpInput = { email: input.email, password: input.password };
      if (input.name) body.name = input.name;
      return apiFetch<AuthResponse>("/auth/register", {
        method: "POST",
        body,
        auth: false,
      });
    },
    onSuccess: (data) => {
      setToken(data.accessToken);
      qc.invalidateQueries({ queryKey: meQueryKey });
    },
  });
}

type ForgotInput = { email: string };
type ForgotResponse = { message: string };

export function useForgotPassword() {
  return useMutation<ForgotResponse, ApiError, ForgotInput>({
    mutationFn: (input) =>
      apiFetch<ForgotResponse>("/auth/forgot-password", {
        method: "POST",
        body: input,
        auth: false,
      }),
  });
}

type ResetInput = { token: string; password: string };
type ResetResponse = { message: string };

export function useResetPassword() {
  return useMutation<ResetResponse, ApiError, ResetInput>({
    mutationFn: (input) =>
      apiFetch<ResetResponse>("/auth/reset-password", {
        method: "POST",
        body: input,
        auth: false,
      }),
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return () => {
    clearToken();
    qc.clear();
    Sentry.setUser(null);
  };
}
