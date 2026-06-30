"""
Email sending via Gmail SMTP (standard library smtplib — no extra deps).

Setup (Gmail / Google Workspace):
  1. Enable 2-Step Verification on the sending account.
  2. Create an App Password (Google Account → Security → App passwords).
  3. Put these in backend/.env:
       SMTP_HOST=smtp.gmail.com
       SMTP_PORT=587
       SMTP_USER=you@wtxindia.com
       SMTP_PASSWORD=the-16-char-app-password   (no spaces)
       FROM_EMAIL=you@wtxindia.com
       FROM_NAME=WTX Voice
       FRONTEND_URL=http://localhost:5173

If SMTP is not configured, send_email() logs a warning and returns False
instead of raising — callers treat the email as best-effort.
"""

import os
import ssl
import smtplib
from email.message import EmailMessage

from loguru import logger
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USER or "")
FROM_NAME = os.getenv("FROM_NAME", "WTX Voice")


def send_email(to: str, subject: str, html_body: str, text_body: str | None = None) -> bool:
    """Send a single email. Returns True on success, False otherwise."""
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning(
            "SMTP not configured (SMTP_USER / SMTP_PASSWORD missing) — "
            f"skipping email to {to} | subject: {subject}"
        )
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
    msg["To"] = to
    msg.set_content(text_body or "Please view this email in an HTML-capable client.")
    msg.add_alternative(html_body, subtype="html")

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls(context=context)
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        logger.info(f"Email sent to {to} | subject: {subject}")
        return True
    except Exception as e:
        logger.error(f"Email send failed to {to}: {e}")
        return False



def send_password_reset_email(to: str, full_name: str, reset_link: str) -> bool:
    """Send the password-reset email with a one-time link."""
    name = full_name or "there"
    subject = "Reset your WTX Voice password"
    text_body = (
        f"Hi {name},\n\n"
        f"We received a request to reset your WTX Voice password.\n"
        f"Open this link to set a new password (valid for 1 hour):\n\n"
        f"{reset_link}\n\n"
        f"If you didn't request this, you can safely ignore this email — "
        f"your password won't change.\n\n"
        f"— WTX Voice"
    )
    html_body = f"""\
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="440" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;border:1px solid #e6e6ec;overflow:hidden;">
          <tr><td style="padding:28px 32px 8px;">
            <span style="font-weight:800;font-size:18px;letter-spacing:-0.5px;color:#1E1E2A;">WTX</span>
            <span style="color:#c3c3cc;">&nbsp;|&nbsp;</span>
            <span style="font-weight:600;font-size:15px;color:#6366f1;">Voice</span>
          </td></tr>
          <tr><td style="padding:8px 32px 0;">
            <h1 style="font-size:19px;color:#1E1E2A;margin:12px 0 6px;">Reset your password</h1>
            <p style="font-size:14px;color:#555;line-height:1.5;margin:0 0 20px;">
              Hi {name}, we received a request to reset your WTX Voice password.
              Click the button below to choose a new one. This link is valid for
              <strong>1 hour</strong>.
            </p>
            <a href="{reset_link}"
               style="display:inline-block;background:#1E1E2A;color:#ffffff;text-decoration:none;
                      font-size:14px;font-weight:600;padding:12px 22px;border-radius:8px;">
              Reset password
            </a>
            <p style="font-size:12px;color:#999;line-height:1.5;margin:24px 0 0;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="{reset_link}" style="color:#6366f1;word-break:break-all;">{reset_link}</a>
            </p>
            <p style="font-size:12px;color:#999;line-height:1.5;margin:20px 0 0;">
              If you didn't request this, you can safely ignore this email — your password won't change.
            </p>
          </td></tr>
          <tr><td style="padding:24px 32px;border-top:1px solid #f0f0f4;margin-top:16px;">
            <p style="font-size:11px;color:#bbb;margin:0;">WTX Voice · WTX India</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""
    return send_email(to, subject, html_body, text_body)