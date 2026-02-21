'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="text-4xl mb-4">😢</div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">문제가 발생했어요</h2>
        <p className="text-sm text-gray-500 mb-6">{error.message || '잠시 후 다시 시도해 주세요.'}</p>
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
