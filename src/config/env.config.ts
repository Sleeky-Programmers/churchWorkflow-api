export const envConfig = () => ({
  db: {
    uri: process.env.DB_URI,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
  },
  email: {
    from: process.env.SMTP_FROM,
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    username: process.env.SMTP_USER,
    password: process.env.SMTP_PASS,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY,
    baseUrl: process.env.PAYSTACK_BASE_URL,
  },
  flutterwave: {
    secretKey: process.env.FLUTTERWAVE_SECRET_KEY,
    publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY,
    baseUrl: process.env.FLUTTERWAVE_BASE_URL,
    redirectUrl: process.env.FLUTTERWAVE_REDIRECT_URL,
  },
  productAdmin: {
    seedName: process.env.PRODUCT_ADMIN_SEED_NAME,
    seedEmail: process.env.PRODUCT_ADMIN_SEED_EMAIL,
    seedPassword: process.env.PRODUCT_ADMIN_SEED_PASSWORD,
    jwtSecret: process.env.PRODUCT_ADMIN_JWT_SECRET,
    jwtExpiresIn: process.env.PRODUCT_ADMIN_JWT_EXPIRES_IN,
  },
});
