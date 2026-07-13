import { useAuth } from "@/lib/auth/context";

export default function SignOutPage() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <button
        onClick={logout}
        style={{
          padding: "12px 24px",
          fontSize: "16px",
          fontWeight: "500",
          background: "#059669",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        Sign Out
      </button>
    </div>
  );
}
