'use client';

import React, { useRef } from 'react';
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { BookOpen } from 'lucide-react';
import { useAccessibility } from './AccessibilityContext';

const AccessibilityTutorial: React.FC = () => {
  const { setIsMenuOpen } = useAccessibility();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  const startTutorial = () => {
    setIsMenuOpen(false);

    setTimeout(() => {
      const driverObj = driver({
        showProgress: true,
        progressText: '{{current}} de {{total}}',
        nextBtnText: 'Siguiente →',
        prevBtnText: '← Anterior',
        doneBtnText: '¡Entendido!',
        overlayColor: 'rgba(0,0,0,0.55)',
        smoothScroll: true,
        animate: true,
        popoverClass: 'unam-driver-popover',
        onDestroyed: () => {
          setIsMenuOpen(false);
        },
        steps: [
          {
            element: '#accessibility-btn',
            popover: {
              title: '♿ Botón de Accesibilidad',
              description:
                'Haz clic aquí en cualquier momento para abrir el menú de accesibilidad y personalizar tu experiencia en la plataforma.',
              side: 'left',
              align: 'center',
              onNextClick: () => {
                setIsMenuOpen(true);
                setTimeout(() => driverObj.moveNext(), 400);
              },
            },
          },
          {
            element: '#accessibility-menu-header',
            popover: {
              title: '🎨 Menú de Accesibilidad',
              description:
                'Desde aquí puedes adaptar la plataforma a tus necesidades visuales y de lectura. Todos los cambios se guardan automáticamente.',
              side: 'bottom',
              align: 'start',
            },
          },
          {
            element: '#accessibility-themes-card',
            popover: {
              title: '🌈 Temas Visuales',
              description:
                'Elige entre <strong>Claro</strong>, <strong>Oscuro</strong> o <strong>Alto Contraste</strong>. El alto contraste es ideal para personas con baja visión.',
              side: 'right',
              align: 'start',
            },
          },
          {
            element: '#accessibility-typography-card',
            popover: {
              title: '📝 Ajustes Tipográficos',
              description:
                'Modifica el <strong>tamaño de letra</strong>, el <strong>espaciado entre caracteres</strong> y el <strong>interlineado</strong> para mejorar la lectura.',
              side: 'right',
              align: 'start',
            },
          },
          {
            element: '#accessibility-features-card',
            popover: {
              title: '⚙️ Funcionalidades Adicionales',
              description:
                'Oculta imágenes para reducir distracciones visuales, o activa la <strong>fuente especial para dislexia</strong> para facilitar la lectura.',
              side: 'right',
              align: 'start',
            },
          },
          {
            element: '#accessibility-reset-btn',
            popover: {
              title: '🔄 Restablecer Configuración',
              description:
                'Si en algún momento quieres volver a los valores originales, usa este botón para restablecer todos los ajustes de accesibilidad.',
              side: 'top',
              align: 'center',
            },
          },
        ] as DriveStep[],
      });

      driverRef.current = driverObj;
      driverObj.drive();
    }, 150);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            id="accessibility-tutorial-btn"
            onClick={startTutorial}
            className={[
              'fixed bottom-6 right-56 z-50',
              'h-14 w-14 rounded-full shadow-lg',
              'bg-violet-600 text-white',
              'hover:bg-violet-700 hover:shadow-xl',
              'transition-all duration-200',
              'border-2 border-background',
            ].join(' ')}
            aria-label="Ver tutorial del menú de accesibilidad"
          >
            <BookOpen className="h-40 w-40" size={160} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Tutorial de Accesibilidad</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export { AccessibilityTutorial };
export default AccessibilityTutorial;
