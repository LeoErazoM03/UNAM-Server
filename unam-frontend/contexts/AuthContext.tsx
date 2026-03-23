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
  emailVerified?: boolean;
}

interface AuthActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  signup: (fullName: string, email: string, password: string) => Promise<AuthActionResult>;
  logout: () => void;
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

const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:3000/graphql';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const redirectBasedOnRole = (user: User) => {
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

    if (highestRole === 'superUser' || highestRole === 'admin') {
      router.push('/admin');
    } else if (highestRole === 'docente') {
      router.push('/teacher');
    } else {
      router.push('/dashboard');
    }
  };

  useEffect(() => {
    const storedToken = getCookie('auth_token');
    if (storedToken) {
      setToken(storedToken);
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
          Authorization: `Bearer ${authToken}`,
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
            token: authToken,
          },
        }),
      });

      const data = await response.json();

      if (data.errors) {
        toast.error('Sesión expirada', {
          description: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
        });
        logout();
        return;
      }

      const userData = data.data.revalidate.user;
      setUser(userData);
      setToken(data.data.revalidate.token);
      setCookie('auth_token', data.data.revalidate.token, 7);

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

  const login = async (email: string, password: string): Promise<AuthActionResult> => {
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
            loginInput: { email, password },
          },
        }),
      });

      const data = await response.json();

      if (data.errors) {
        const errorMessage = data.errors[0].message as string;
        if (errorMessage.includes('verificar tu correo')) {
          return {
            success: false,
            error: 'Debes verificar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
          };
        }
        if (
          errorMessage.includes('Invalid credentials') ||
          errorMessage.includes('password') ||
          errorMessage.includes('email') ||
          errorMessage.includes('User not found')
        ) {
          return { success: false, error: 'Email o contraseña incorrectos' };
        }
        return { success: false, error: 'Error al iniciar sesión. Inténtalo de nuevo.' };
      }

      const userData = data.data.login.user;
      setUser(userData);
      setToken(data.data.login.token);
      setCookie('auth_token', data.data.login.token, 7);
      redirectBasedOnRole(userData);

      return { success: true, message: 'Sesión iniciada exitosamente' };
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
    password: string,
  ): Promise<AuthActionResult> => {
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
                success
                message
              }
            }
          `,
          variables: {
            signUpInput: { fullName, email, password },
          },
        }),
      });

      const data = await response.json();

      if (data.errors) {
        const errorMessage = data.errors[0].message as string;
        if (
          errorMessage.includes('already exists') ||
          errorMessage.includes('duplicate') ||
          errorMessage.includes('correo') ||
          errorMessage.includes('email')
        ) {
          return { success: false, error: 'Este email ya está registrado' };
        }
        if (errorMessage.includes('password')) {
          return {
            success: false,
            error: 'La contraseña debe tener al menos 6 caracteres',
          };
        }
        return { success: false, error: 'Error al registrarse. Inténtalo de nuevo.' };
      }

      return {
        success: true,
        message:
          data.data.signin.message ||
          'Te enviamos un correo de verificación. Revisa tu bandeja de entrada.',
      };
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
