# CommunityHub authentication setup

Run `npm run add-auth-verification` from the server directory to update an existing database. Fresh databases get the same columns from the schema.

CommunityHub launches with email and password. Leave `REQUIRE_EMAIL_VERIFICATION` unset or set it to `false` to allow immediate sign-in after registration. Accounts created in this mode retain an unverified email address.

## Verification email

Add these settings to the ignored server .env file:

- `REQUIRE_EMAIL_VERIFICATION=true` to require verification. Existing users with unverified addresses will need to verify before signing in.
- `RESEND_API_KEY` with a key authorised to send email.
- `VERIFICATION_FROM` with a sender on a domain configured in Resend.
- `CLIENT_ORIGIN` with the frontend origin, such as `http://127.0.0.1:5173` locally. Use HTTPS for deployed instances.

Disable click tracking for verification mail so the provider does not rewrite verification links. Restart the API after updating the settings. Register with an inbox you control and choose a password. Open the emailed link and confirm that password to verify the account before signing in. The link expires after 30 minutes and can only be used once. The verification page can request a fresh link.

## Google sign-in (planned after deployment)

Leave `GOOGLE_CLIENT_ID` unset until Google sign-in is ready to enable.

Create a Google OAuth client of type Web application and add the exact frontend origins under Authorised JavaScript origins. Put the public client ID in `GOOGLE_CLIENT_ID` in server .env and restart the API. The sign-in button appears when the client ID is configured.

First-time Google sign-in can create accounts for verified Gmail and Google Workspace addresses. Other addresses use the email verification flow first. To connect Google to an existing account, sign in to CommunityHub, open your profile and choose the Google button in Account Details. Use the Google account with the same email address.

The PostgreSQL integration test simulates email delivery and Google credentials. Test each provider with a real account before enabling it for users.
