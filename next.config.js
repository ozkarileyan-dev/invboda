/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./index.html", "./public/index.html"]
  }
};

module.exports = nextConfig;