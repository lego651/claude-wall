// Public layout for admin/strategies/public routes
// This layout bypasses admin authentication requirement
// These routes are publicly accessible
export default function PublicStrategiesLayout({ children }) {
  return <>{children}</>;
}
