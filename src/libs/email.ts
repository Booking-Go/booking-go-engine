import { logger } from './logger';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

/**
 * Email sending utility.
 * Currently a stub that logs the email. Replace with SendGrid / Resend / SES in production.
 */
export const email = {
  /** Send an email with the given options. Returns `true` on success. */
  async send(options: SendEmailOptions): Promise<boolean> {
    try {
      // TODO: Replace with actual email provider (SendGrid, Resend, AWS SES)
      logger.info('Email sent (stub)', {
        to: options.to,
        subject: options.subject,
      });

      if (process.env.NODE_ENV === 'development') {
        logger.debug('Email content', { html: options.html });
      }

      return true;
    } catch (err: unknown) {
      logger.error('Email send failed', { to: options.to, error: err });
      return false;
    }
  },

  /**
   * Send a password reset email.
   */
  async sendPasswordReset(to: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    return this.send({
      to,
      subject: 'Booking.go — Reset Your Password',
      html: `
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    });
  },

  /**
   * Send a booking confirmation email.
   */
  async sendBookingConfirmation(
    to: string,
    details: { businessName: string; serviceName: string; date: string; time: string },
  ): Promise<boolean> {
    return this.send({
      to,
      subject: `Booking Confirmed — ${details.businessName}`,
      html: `
        <h2>Booking Confirmed!</h2>
        <p><strong>Business:</strong> ${details.businessName}</p>
        <p><strong>Service:</strong> ${details.serviceName}</p>
        <p><strong>Date:</strong> ${details.date}</p>
        <p><strong>Time:</strong> ${details.time}</p>
      `,
    });
  },

  /**
   * Send an email verification email.
   */
  async sendVerification(to: string, verificationToken: string): Promise<boolean> {
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    return this.send({
      to,
      subject: 'Booking.go — Verify Your Email',
      html: `
        <h2>Verify Your Email</h2>
        <p>Click the link below to verify your email address.</p>
        <a href="${verifyUrl}">Verify Email</a>
      `,
    });
  },
};
