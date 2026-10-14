import rateLimit from "express-rate-limit";

// Limits only apply in production. While developing, every page load and the background refreshes would use them up
// within minutes and the app would stop showing data ("Too many requests").
const offOutsideProduction = () => process.env.NODE_ENV !== "production";

export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // Everyone on the venue's Wi-Fi shares one public address, and each open app refreshes in the background, so this
  // has to be generous. It is only a safety net against a script hammering the API.
  max: 3000,
  message: "Too many requests from this IP, please try again later.",
  skip: offOutsideProduction,
});

export const authRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 sign-in attempts per window
  message: "Too many login attempts, please try again later.",
  skip: offOutsideProduction,
});

export default rateLimitMiddleware;
