import os
import smtplib
from email.mime.text import MIMEText

def send_smtp_email(to_email: str, subject: str, body: str) -> None:
    """Send an email via SMTP. Called from BackgroundTasks so failures are logged, not raised to the user."""
    host = os.getenv("SMTP_HOST", "")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    from_email = os.getenv("EMAILS_FROM_EMAIL", user)

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email

    try:
        with smtplib.SMTP(host, port, timeout=10) as smtp:
            smtp.starttls()
            if user:
                smtp.login(user, password)
            smtp.sendmail(from_email, [to_email], msg.as_string())
    except Exception as exc:
        # shortcut: uncaught errors go to server logs, not to the user; add proper logging when needed
        print(f"SMTP error sending to {to_email}: {exc}")
