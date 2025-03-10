'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '../../../../components/ui/alert';
import { authApi } from '../../../../lib/api-clients/auth';
import { AuthLayout } from '../../../../components/AuthLayout';

export default function VerifyEmail() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const response = await authApi.verifyEmail(params.token as string);
        
        if (response.success) {
          setStatus('success');
          setTimeout(() => {
            router.push('/auth/login');
          }, 3000);
        } else {
          setStatus('error');
        }
      } catch (_error) {
        setStatus('error');
      }
    };

    verifyEmail();
  }, [params.token, router]);

  return (
    <AuthLayout title="Verify Email">
      {status === 'loading' && (
        <Alert variant="default"><AlertDescription>Verifying your email address...</AlertDescription></Alert>
      )}
      {status === 'success' && (
        <Alert variant="default"><AlertDescription>Email verified successfully! Redirecting to login...</AlertDescription></Alert>
      )}
      {status === 'error' && (
        <Alert variant="destructive"><AlertDescription>Failed to verify email. The link may be invalid or expired.</AlertDescription></Alert>
      )}
    </AuthLayout>
  )
}
