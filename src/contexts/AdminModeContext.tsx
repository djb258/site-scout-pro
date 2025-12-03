import { createContext, useContext, useState, ReactNode } from "react";

interface AdminModeContextType {
  adminMode: boolean;
  setAdminMode: (value: boolean) => void;
}

const AdminModeContext = createContext<AdminModeContextType>({
  adminMode: false,
  setAdminMode: () => {},
});

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const [adminMode, setAdminMode] = useState(false);

  return (
    <AdminModeContext.Provider value={{ adminMode, setAdminMode }}>
      {children}
    </AdminModeContext.Provider>
  );
}

export function useAdminMode() {
  return useContext(AdminModeContext);
}
