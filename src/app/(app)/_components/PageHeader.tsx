'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  breadcrumbs: Breadcrumb[];
  title: string;
}

export function PageHeader({ breadcrumbs, title }: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <nav className="text-sm text-gray-500 mb-1">
          {breadcrumbs.map((b, i) => (
            <span key={i}>
              {b.href ? (
                <Link href={b.href} className="hover:underline">
                  {b.label}
                </Link>
              ) : (
                b.label
              )}
              {i < breadcrumbs.length - 1 && <span className="mx-1">›</span>}
            </span>
          ))}
        </nav>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      </div>
      <button
        onClick={() => router.back()}
        aria-label="Cerrar"
        className="p-2 text-gray-400 hover:text-gray-700 rounded-md"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
