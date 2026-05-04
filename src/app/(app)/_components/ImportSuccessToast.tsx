'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ImportSuccessToastProps {
  count: number
}

export function ImportSuccessToast({ count }: ImportSuccessToastProps) {
  const [visible, setVisible] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      router.replace('/')
    }, 3000)
    return () => clearTimeout(t)
  }, [router])

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white shadow-lg">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={3}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <span className="text-sm font-semibold whitespace-nowrap">
        {count} producto{count !== 1 ? 's' : ''} importado{count !== 1 ? 's' : ''}
      </span>
    </div>
  )
}
