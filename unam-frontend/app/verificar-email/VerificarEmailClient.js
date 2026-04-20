'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, MailCheck, MailWarning, RefreshCcw } from 'lucide-react';

const GRAPHQL_ENDPOINT =
    process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:3000/graphql';

export default function VerificarEmailClient() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const email = searchParams.get('email') || '';

    const [code, setCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [state, setState] = useState('idle'); // idle | success | error
    const [message, setMessage] = useState(
        'Ingresa el código de verificación que enviamos a tu correo.',
    );

    const title = useMemo(() => {
        if (state === 'success') return 'Correo verificado';
        if (state === 'error') return 'No se pudo verificar el correo';
        return 'Verifica tu cuenta';
    }, [state]);

    const handleVerifyCode = async () => {
        if (!email) {
            setState('error');
            setMessage('No se encontró el correo asociado a la verificación.');
            return;
        }

        if (!code || code.trim().length !== 6) {
            setState('error');
            setMessage('Ingresa un código válido de 6 dígitos.');
            return;
        }

        try {
            setIsVerifying(true);
            setState('idle');
            setMessage('Validando tu código...');

            const response = await fetch(GRAPHQL_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: `
            mutation VerifyEmailCode($email: String!, $code: String!) {
              verifyEmailCode(email: $email, code: $code) {
                success
                message
                token
                user {
                  id
                  email
                  fullName
                }
              }
            }
          `,
                    variables: {
                        email,
                        code,
                    },
                }),
            });

            const data = await response.json();

            if (data.errors?.length) {
                setState('error');
                setMessage(data.errors[0].message || 'No fue posible verificar tu correo.');
                return;
            }

            const result = data.data?.verifyEmailCode;

            if (result?.success) {
                setState('success');
                setMessage(
                    result.message ||
                    'Tu cuenta fue verificada correctamente. Ya puedes iniciar sesión.',
                );
                return;
            }

            setState('error');
            setMessage(result?.message || 'No fue posible verificar tu correo.');
        } catch (error) {
            console.error('Error verificando código:', error);
            setState('error');
            setMessage('Ocurrió un error de conexión al intentar verificar tu correo.');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResendCode = async () => {
        if (!email) {
            setState('error');
            setMessage('No se encontró el correo asociado a la verificación.');
            return;
        }

        try {
            setIsResending(true);

            const response = await fetch(GRAPHQL_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: `
            mutation ResendVerificationCode($email: String!) {
              resendVerificationCode(email: $email) {
                success
                message
              }
            }
          `,
                    variables: { email },
                }),
            });

            const data = await response.json();

            if (data.errors?.length) {
                setState('error');
                setMessage(data.errors[0].message || 'No fue posible reenviar el código.');
                return;
            }

            const result = data.data?.resendVerificationCode;

            if (result?.success) {
                setState('idle');
                setMessage(
                    result.message || 'Te enviamos un nuevo código de verificación a tu correo.',
                );
                return;
            }

            setState('error');
            setMessage(result?.message || 'No fue posible reenviar el código.');
        } catch (error) {
            console.error('Error reenviando código:', error);
            setState('error');
            setMessage('Ocurrió un error de conexión al reenviar el código.');
        } finally {
            setIsResending(false);
        }
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
            <Card className="w-full max-w-lg">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border">
                        {isVerifying ? (
                            <Loader2 className="h-7 w-7 animate-spin" />
                        ) : state === 'success' ? (
                            <MailCheck className="h-7 w-7" />
                        ) : (
                            <MailWarning className="h-7 w-7" />
                        )}
                    </div>

                    <CardTitle>{title}</CardTitle>
                    <CardDescription>
                        Confirma tu identidad para activar tu cuenta y empezar a usar la plataforma.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Correo electrónico</label>
                        <Input value={email} disabled />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Código de verificación</label>
                        <Input
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="Ingresa tu código de 6 dígitos"
                            inputMode="numeric"
                            maxLength={6}
                        />
                    </div>

                    <p className="text-sm text-muted-foreground">{message}</p>

                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                        <Button onClick={handleVerifyCode} disabled={isVerifying}>
                            {isVerifying ? 'Verificando...' : 'Verificar código'}
                        </Button>

                        <Button
                            variant="outline"
                            onClick={handleResendCode}
                            disabled={isResending}
                        >
                            {isResending ? (
                                'Reenviando...'
                            ) : (
                                <>
                                    <RefreshCcw className="mr-2 h-4 w-4" />
                                    Reenviar código
                                </>
                            )}
                        </Button>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                        <Button variant="ghost" onClick={() => router.push('/dashboard')}>
                            Ir al inicio
                        </Button>

                        {state === 'success' && (
                            <Button variant="secondary" onClick={() => router.push('/dashboard')}>
                                Continuar
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}