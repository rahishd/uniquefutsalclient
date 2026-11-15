process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://unique:unique_dev_pw@localhost:5439/unique_test?schema=public";
process.env.JWT_SECRET = "test-jwt-secret-0123456789abcdef";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret-0123456789abcdef";
process.env.OTP_ENABLED = "false";
process.env.ALLOWED_ORIGINS = "http://localhost:3000";
process.env.GOOGLE_CLIENT_ID = "test-client-id";
// tests never send real texts: the gateway keys in .env are not used
process.env.SMS_PROVIDER = "sparrow";
process.env.SPARROW_SMS_TOKEN = "";
process.env.SPARROW_SMS_IDENTITY = "";
process.env.SMSGATE_USERNAME = "";
process.env.SMSGATE_PASSWORD = "";
// customer sign-up through the old password-only route stays open for the automated tests (production requires the SMS code)
process.env.REQUIRE_SIGNUP_OTP = "false";
