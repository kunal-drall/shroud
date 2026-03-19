/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    // Stub optional wagmi connector peer deps that are not installed
    config.resolve.alias = {
      ...config.resolve.alias,
      'porto/internal': false,
      '@safe-global/safe-apps-sdk': false,
      '@safe-global/safe-apps-provider': false,
      '@coinbase/wallet-sdk': false,
      '@base-org/account': false,
      '@metamask/sdk': false,
      '@walletconnect/ethereum-provider': false,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      readline: false,
      path: false,
      crypto: false,
    };
    // Handle snarkjs
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });
    return config;
  },
};

export default nextConfig;
