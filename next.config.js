/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./public/index.html"]
  }
};

module.exports = nextConfig;