import type { LoginValues, SignupValues, PasswordResetValues } from '../../lib/schemas/auth';
import type { LoginApiResponse } from '../../app/api/auth/login/route';
import type { SignupApiResponse } from '../../app/api/auth/signup/route';
import type { VerifyEmailApiResponse } from '../../app/api/auth/verify-email/route';
import type { PasswordResetApiResponse } from '../../app/api/auth/reset-password/route';
import type { ForgotPasswordApiResponse } from '../../app/api/auth/forgot-password/route';

export class AuthApi {
  private baseUrl: string;

  constructor(baseUrl = '/api/auth') {
    this.baseUrl = baseUrl;
  }

  async login(data: LoginValues): Promise<LoginApiResponse> {
    const response = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    return response.json();
  }

  async signup(data: SignupValues): Promise<SignupApiResponse> {
    const response = await fetch(`${this.baseUrl}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    return response.json();
  }

  async requestPasswordReset(email: string): Promise<ForgotPasswordApiResponse> {
    const response = await fetch(`${this.baseUrl}/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    return response.json();
  }

  async resetPassword(data: PasswordResetValues): Promise<PasswordResetApiResponse> {
    const response = await fetch(`${this.baseUrl}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    return response.json();
  }

  async verifyEmail(token: string): Promise<VerifyEmailApiResponse> {
    const response = await fetch(`${this.baseUrl}/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    return response.json();
  }
}

export const authApi = new AuthApi();
