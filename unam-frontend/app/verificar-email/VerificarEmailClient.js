// app/verificar-email/VerificarEmailClient.js
export const dynamic = 'force-dynamic';
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MailCheck, MailWarning } from 'lucide-react';

const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:3000/graphql';

export default function VerificarEmailClient() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [state, setState] = useState('loading');
    const [message, setMessage] = useState('Estamos validando tu enlace de verificación...');

    const title = useMemo(() => {
        if (state === 'success') return 'Correo verificado';
        if (state === 'error') return 'No se pudo verificar el correo';
        return 'Verificando tu cuenta';
    }, [state]);

    useEffect(() => {
        const verifyEmail = async () => {
            if (!token) {
                setState('error');
                setMessage('El enlace no contiene un token de verificación válido.');
                return;
            }

            try {
                const response = await fetch(GRAPHQL_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query: `
              mutation VerifyEmail($token: String!) {
                verifyEmail(token: $token) {
                  success
                  message
                }
              }
            `,
                        variables: { token },
                    }),
                });

                const data = await response.json();

                if (data.errors?.length) {
                    setState('error');
                    setMessage(data.errors[0].message || 'No fue posible verificar tu correo.');
                    return;
                }

                setState(data.data.verifyEmail.success ? 'success' : 'error');
                setMessage(data.data.verifyEmail.message);
            } catch (error) {
                console.error('Email verification failed:', error);
                setState('error');
                setMessage('Ocurrió un error de conexión al intentar verificar tu correo.');
            }
        };

        verifyEmail();
    }, [token]);

    return (
        <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
            <Card className="w-full max-w-lg">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border">
                        {state === 'loading' ? (
                            <Loader2 className="h-7 w-7 animate-spin" />
                        ) : state === 'success' ? (
                            <MailCheck className="h-7 w-7" />
                        ) : (
                            <MailWarning className="h-7 w-7" />
                        )}
                    </div>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>
                        Confirma tu identidad para activar tu cuenta y empezar a guardar tu progreso.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                    <p className="text-sm text-muted-foreground">{message}</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                        <Button onClick={() => router.push('/dashboard')}>Ir al inicio</Button>
                        {state === 'success' && (
                            <Button variant="outline" onClick={() => router.push('/dashboard')}>
                                Iniciar sesión
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}