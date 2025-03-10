'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '../../../../components/ui/form';
import { Input } from '../../../../components/ui/input';
import { Button } from '../../../../components/ui/button';
import { passwordResetSchema, type PasswordResetValues } from '../../../../lib/schemas/auth';
import { authApi } from '../../../../lib/api-clients/auth';
import { AuthLayout } from '../../../../components/AuthLayout';

export default function ResetPassword() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const params = useParams();
  const router = useRouter();

  const form = useForm<PasswordResetValues>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: PasswordResetValues) => {
    setStatus('loading');

    try {
      const response = await authApi.resetPassword({
        token: params.token as string,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });

      if (response.success) {
        setStatus('success');
        setMessage('Password reset successfully!');
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(response.error || 'Failed to reset password. The link may be invalid or expired.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('An error occurred. Please try again.');
      form.setError('password', { message: error as string });
    }
  };

  return (
    <AuthLayout title="Reset Password">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={status === 'loading'} className="w-full">
            {status === 'loading' ? 'Resetting...' : 'Reset Password'}
          </Button>
        </form>
      </Form>

      {status !== 'idle' && (
        <Alert variant={status === 'success' ? 'default' : 'destructive'} className="mt-6">
          <AlertTitle>
            {status === 'success' ? 'Success' : 'Error'}
          </AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
    </AuthLayout>
  );
}
