/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['xlsx'],
  // Doğrulama derlemeleri `npm run dev` çalışırken .next'i bozmasın diye ayrı klasöre alınabilir:
  // NEXT_DIST_DIR=.next-verify npx next build
  distDir: process.env.NEXT_DIST_DIR || '.next',
};
export default nextConfig;
