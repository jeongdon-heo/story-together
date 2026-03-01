import AuthGuard from '../../components/auth/AuthGuard';

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRoles={['student', 'guest', 'teacher']}>{children}</AuthGuard>
  );
}
