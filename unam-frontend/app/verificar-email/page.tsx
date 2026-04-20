import { Suspense } from 'react';
import VerificarEmailClient from './VerificarEmailClient';

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <VerificarEmailClient />
        </Suspense>
    );
}