"use client";

import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  validateSignupForm,
  validateLoginForm,
  type SignupFormData,
  type LoginFormData
} from '@/schemas/user-forms';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, mode }) => {
  const { login, signup, isLoading } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validar con Zod
    let validationResult;
    if (mode === 'login') {
      const loginData: LoginFormData = {
        email: formData.email,
        password: formData.password
      };
      validationResult = validateLoginForm(loginData);
    } else {
      const signupData: SignupFormData = {
        email: formData.email,
        fullName: formData.fullName,
        password: formData.password
      };
      validationResult = validateSignupForm(signupData);
    }

    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {};
      validationResult.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      toast.error('Por favor corrige los errores en el formulario');
      return;
    }

    let result;
    if (mode === 'login') {
      result = await login(formData.email, formData.password);
    } else {
      result = await signup(formData.fullName, formData.email, formData.password);
    }

    console.log('AUTH MODAL RESULT:', result);

    if (!result.success) {
      toast.error(result.error || 'Ocurrió un error');
      return;
    }

    if (mode === 'register') {
      const emailToVerify = formData.email.trim();

      onClose();
      setFormData({ fullName: '', email: '', password: '' });
      setErrors({});
      toast.success('Cuenta creada. Revisa tu correo para verificarla.');
      router.push(`/verificar-email?email=${encodeURIComponent(emailToVerify)}`);
      return;
    }

    onClose();
    setFormData({ fullName: '', email: '', password: '' });
    setErrors({});
    toast.success('Sesión iniciada exitosamente');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'login' ? 'Iniciar Sesión' : 'Registrarse'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-2">
              <label htmlFor="fullName" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Nombre Completo</label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleInputChange}
                required
                disabled={isLoading}
                className={errors.fullName ? 'border-red-500' : ''}
              />
              {errors.fullName && (
                <p className="text-sm text-red-500">{errors.fullName}</p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Correo Electrónico</label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              disabled={isLoading}
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email}</p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Contraseña</label>
            <Input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              disabled={isLoading}
              className={errors.password ? 'border-red-500' : ''}
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === 'login' ? 'Iniciando...' : 'Registrando...'}
              </>
            ) : (
              mode === 'login' ? 'Iniciar Sesión' : 'Registrarse'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};