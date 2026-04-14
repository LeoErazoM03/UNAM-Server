"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCookie, setCookie, removeCookie } from '@/lib/cookies';
import { toast } from 'sonner';

interface User {
  id: string;
  fullName: string;
  email: string;
  roles: string[];
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (
    fullName: string,
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean; email?: string }>; logout: () => void;
  isLoading: boolean;
  redirectBasedOnRole: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:3000/graphql";

function isErrorWithMessage(error: unknown): error is { message: string } {
  return typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Función para redireccionar basado en el rol del usuario
  const redirectBasedOnRole = (user: User) => {
    // Determinar el rol más alto del usuario
    const roleHierarchy = {
      superUser: 5,
      admin: 4,
      docente: 3,
      alumno: 2,
      mortal: 1,
    };

    let highestRole = 'mortal';
    let highestLevel = 0;

    for (const role of user.roles) {
      const level = roleHierarchy[role as keyof typeof roleHierarchy] || 0;
      if (level > highestLevel) {
        highestLevel = level;
        highestRole = role;
      }
    }

    // Redireccionar basado en el rol más alto
    if (highestRole === 'superUser' || highestRole === 'admin') {
      router.push('/admin');
    } else if (highestRole === 'docente') {
      router.push('/teacher');
    } else {
      router.push('/dashboard');
    }
  };

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = getCookie('auth_token');
    if (storedToken) {
      setToken(storedToken);
      // Validate token with revalidate query
      revalidateToken(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const revalidateToken = async (authToken: string) => {
    try {
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query: `
            query Revalidate($token: String) {
              revalidate(token: $token) {
                token
                user {
                  id
                  fullName
                  email
                  roles
                  isActive
                }
              }
            }
          `,
          variables: {
            token: authToken
          }
        }),
      });

      const data = await response.json();

      if (data.errors) {
        // Mostrar toast de error en lugar de lanzar excepción
        toast.error('Sesión expirada', {
          description: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
        });
        logout();
        return;
      }

      const userData = data.data.revalidate.user;
      setUser(userData);
      setToken(data.data.revalidate.token);
      setCookie('auth_token', data.data.revalidate.token, 7);

      // Solo redireccionar si estamos en la página de dashboard (página inicial)
      if (window.location.pathname === '/dashboard') {
        redirectBasedOnRole(userData);
      }
    } catch (error) {
      console.error('Token validation failed:', error);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation Login($loginInput: LoginInput!) {
              login(loginInput: $loginInput) {
                token
                user {
                  id
                  fullName
                  email
                  roles
                  isActive
                }
              }
            }
          `,
          variables: {
            loginInput: { email, password }
          }
        }),
      });

      const data = await response.json();

      if (data.errors) {
        // Transformar errores de GraphQL en mensajes más amigables
        const errorMessage = data.errors[0].message;
        if (errorMessage.includes('Invalid credentials') ||
          errorMessage.includes('password') ||
          errorMessage.includes('email') ||
          errorMessage.includes('User not found')) {
          return { success: false, error: 'Email o contraseña incorrectos' };
        }
        return { success: false, error: 'Error al iniciar sesión. Inténtalo de nuevo.' };
      }

      const userData = data.data.login.user;
      setUser(userData);
      setToken(data.data.login.token);
      setCookie('auth_token', data.data.login.token, 7);

      // Redireccionar automáticamente basado en el rol
      redirectBasedOnRole(userData);

      return { success: true };
    } catch (error: unknown) {
      console.error('Login failed:', error);
      return { success: false, error: 'Error de conexión. Verifica tu conexión a internet.' };
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (
    fullName: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; requiresVerification?: boolean; email?: string }> => {
    setIsLoading(true);
    try {
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation Signup($signUpInput: SignupInput!) {
              signin(signUpInput: $signUpInput) {
                token
                user {
                  id
                  fullName
                  email
                  roles
                  isActive
                }
              }
            }
          `,
          variables: {
            signUpInput: { fullName, email, password }
          }
        }),
      });

      const data = await response.json();

      if (data.errors) {
        // Transformar errores de GraphQL en mensajes más amigables
        const errorMessage = data.errors[0].message;
        if (errorMessage.includes('already exists') ||
          errorMessage.includes('duplicate') ||
          errorMessage.includes('email')) {
          return { success: false, error: 'Este email ya está registrado' };
        }
        if (errorMessage.includes('password')) {
          return { success: false, error: 'La contraseña debe tener al menos 6 caracteres' };
        }
        return { success: false, error: 'Error al registrarse. Inténtalo de nuevo.' };
      }

      const signInData = data?.data?.signin;

      if (!signInData?.user) {
        return { success: false, error: 'No se pudo completar el registro.' };
      }

      // Si el backend no devuelve token, significa que el usuario debe verificar su correo
      if (!signInData.token) {
        return {
          success: true,
          requiresVerification: true,
          email,
        };
      }

      // Fallback por si en algún flujo futuro sí devuelve token
      setUser(signInData.user);
      setToken(signInData.token);
      setCookie('auth_token', signInData.token, 7);

      return { success: true };
    } catch (error: unknown) {
      console.error('Signup failed:', error);
      return { success: false, error: 'Error de conexión. Verifica tu conexión a internet.' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    removeCookie('auth_token');
    setIsLoading(false);
    router.push('/dashboard');
  };

  const value = {
    user,
    token,
    login,
    signup,
    logout,
    isLoading,
    redirectBasedOnRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};