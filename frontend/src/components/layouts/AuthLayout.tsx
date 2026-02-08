import { Outlet, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

export default function AuthLayout() {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  // If already authenticated, redirect to POS
  if (isAuthenticated) {
    return <Navigate to="/pos" replace />;
  }

  return (
    <div className="min-h-screen bg-pos-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
