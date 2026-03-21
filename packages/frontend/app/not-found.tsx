import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-4">
      <h1 className="text-6xl font-bold text-gray-200">404</h1>
      <p className="text-gray-400 max-w-sm">
        This page doesn&apos;t exist. The circle you&apos;re looking for may have completed its rounds.
      </p>
      <Link
        href="/"
        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition-colors"
      >
        Back to home
      </Link>
    </div>
  );
}
