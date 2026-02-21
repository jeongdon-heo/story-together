export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm font-medium">학생 계정 불러오는 중...</p>
      </div>
    </div>
  );
}
