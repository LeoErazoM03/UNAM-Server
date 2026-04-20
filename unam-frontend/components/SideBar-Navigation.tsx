"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import LearningContent from "./sidebar/LearningContent";
import SearchContent from "./sidebar/SearchContent";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "./auth/AuthModal";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/role-badge";
import { User, LogIn, UserPlus, LogOut } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AppSidebar() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const handleAuthClick = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 px-4 py-2 cursor-pointer rounded-lg">
            {/* Logo */}
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-sm font-bold">É</span>
            </div>
            {/* Texto */}
            <span className="font-semibold">Éskani</span>
            {/* Botón de ayuda */}
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={() => router.push('/help')}
            >
              ?
            </Button>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {user ? (
            <LearningContent />
          ) : (
            <div className="space-y-4">
              <div className="px-4 py-2">
                <SearchContent />
              </div>
              <LearningContent />
            </div>
          )}
        </SidebarContent>

        <SidebarFooter>
          {user ? (
            <div className="px-4 py-2 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.fullName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {user.roles.map((role, index) => (
                  <RoleBadge key={index} role={role} className="text-xs" />
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="w-full"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar Sesión
              </Button>
            </div>
          ) : (
            <div className="px-4 py-2 space-y-2">
              <div className="pt-2 border-t space-y-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleAuthClick('login')}
                  className="w-full"
                  disabled={isLoading}
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Iniciar Sesión
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAuthClick('register')}
                  className="w-full"
                  disabled={isLoading}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Registrarse
                </Button>
              </div>
              <div className="text-xs text-muted-foreground text-center pt-2">
                © 2026 UNAM Escuela
              </div>
            </div>
          )}
        </SidebarFooter>
      </Sidebar>

      <ErrorBoundary>
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          mode={authMode}
        />
      </ErrorBoundary>
    </>
  );
}