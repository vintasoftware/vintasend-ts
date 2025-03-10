import Link from 'next/link';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { AuthLayout } from '../../../components/AuthLayout';

export default function VerifyEmailSentPage() {
  return (
    <AuthLayout title="Check Your Email">
      <Alert>
        <AlertDescription>
          We've sent you a verification link. Please check your inbox and click the
          link to activate your account.
        </AlertDescription>
      </Alert>
      <p className="text-center text-sm text-gray-600 mt-4">
        Didn't receive the email?{' '}
        <Link href="/auth/signup" className="text-blue-600 hover:underline">
          Try signing up again
        </Link>
        {' or '}
        <Link href="/auth/login" className="text-blue-600 hover:underline">
          return to login
        </Link>
      </p>
    </AuthLayout>
  );
}