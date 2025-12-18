import { Outlet } from "react-router-dom";
import { AppNav } from "./AppNav";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppNav />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
