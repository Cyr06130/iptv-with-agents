/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // PAPI + host-papp use WASM modules (sr25519, verifiablejs)
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Silence "target doesn't support async/await" warning for WASM modules
    // All modern browsers support async/await
    if (!isServer) {
      config.target = "web";
    }

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }

    return config;
  },
};

export default nextConfig;
