'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Palette,
  Type,
  Move,
  AlignLeft,
  ImageOff,
  Brain,
  RotateCcw,
  Sun,
  Moon,
  Contrast,
  PersonStanding,
} from 'lucide-react';
import { useAccessibility, type Theme, type FontSize, type LetterSpacing, type LineHeight } from './AccessibilityContext';
import { toast } from 'sonner';

const AccessibilityMenu: React.FC = () => {
  const {
    settings,
    updateTheme,
    updateFontSize,
    updateLetterSpacing,
    updateLineHeight,
    toggleImages,
    toggleDyslexiaFont,
    resetSettings,
    isMenuOpen,
    setIsMenuOpen,
  } = useAccessibility();

  const handleThemeChange = (theme: Theme) => {
    updateTheme(theme);
    toast.success(`Tema cambiado a ${getThemeLabel(theme)}`);
  };

  const handleFontSizeChange = (fontSize: FontSize) => {
    updateFontSize(fontSize);
    toast.success(`Tamaño de fuente cambiado a ${getFontSizeLabel(fontSize)}`);
  };

  const handleLetterSpacingChange = (spacing: LetterSpacing) => {
    updateLetterSpacing(spacing);
    toast.success(`Espaciado de caracteres cambiado a ${getLetterSpacingLabel(spacing)}`);
  };

  const handleLineHeightChange = (height: LineHeight) => {
    updateLineHeight(height);
    toast.success(`Interlineado cambiado a ${getLineHeightLabel(height)}`);
  };

  const handleToggleImages = () => {
    toggleImages();
    toast.success(settings.hideImages ? 'Imágenes mostradas' : 'Imágenes ocultadas');
  };

  const handleToggleDyslexiaFont = () => {
    toggleDyslexiaFont();
    toast.success(settings.dyslexiaFont ? 'Fuente normal activada' : 'Fuente para dislexia activada');
  };

  const handleResetSettings = () => {
    resetSettings();
    toast.success('Configuraciones restablecidas a valores predeterminados');
  };

  const getThemeLabel = (theme: Theme): string => {
    switch (theme) {
      case 'light': return 'Claro';
      case 'dark': return 'Oscuro';
      case 'high-contrast': return 'Alto Contraste';
      default: return theme;
    }
  };

  const getFontSizeLabel = (size: FontSize): string => {
    switch (size) {
      case 'sm': return 'Pequeño';
      case 'md': return 'Mediano';
      case 'lg': return 'Grande';
      default: return size;
    }
  };

  const getLetterSpacingLabel = (spacing: LetterSpacing): string => {
    switch (spacing) {
      case 'normal': return 'Normal';
      case 'wide': return 'Amplio';
      case 'wider': return 'Muy Amplio';
      default: return spacing;
    }
  };

  const getLineHeightLabel = (height: LineHeight): string => {
    switch (height) {
      case 'normal': return 'Normal';
      case 'relaxed': return 'Relajado';
      case 'loose': return 'Suelto';
      default: return height;
    }
  };

  const getThemeIcon = (theme: Theme) => {
    switch (theme) {
      case 'light': return <Sun className="h-4 w-4" />;
      case 'dark': return <Moon className="h-4 w-4" />;
      case 'high-contrast': return <Contrast className="h-4 w-4" />;
      default: return <Sun className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader id="accessibility-menu-header">
          <DialogTitle className="flex items-center gap-2">
            <PersonStanding className="h-5 w-5" />
            Menú de Accesibilidad
          </DialogTitle>
          <DialogDescription>
            Personaliza la experiencia visual y de navegación según tus necesidades
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Temas Visuales */}
          <Card id="accessibility-themes-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-4 w-4" />
                Temas Visuales
              </CardTitle>
              <CardDescription>
                Selecciona el tema que mejor se adapte a tus necesidades visuales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {(['light', 'dark', 'high-contrast'] as Theme[]).map((theme) => (
                  <Button
                    key={theme}
                    variant={settings.theme === theme ? 'default' : 'outline'}
                    className={`flex flex-col items-center gap-2 h-auto py-4 relative transition-all duration-200 hover:scale-105 ${theme === 'high-contrast' ? 'border-2' : ''}`}
                    onClick={() => handleThemeChange(theme)}
                  >
                    <div className="flex-shrink-0">
                      {React.cloneElement(getThemeIcon(theme), { className: 'h-5 w-5' })}
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-sm">{getThemeLabel(theme)}</div>
                      <div className="text-xs text-muted-foreground mt-1 leading-tight">
                        {theme === 'light' && 'Claro'}
                        {theme === 'dark' && 'Oscuro'}
                        {theme === 'high-contrast' && 'Alto contraste'}
                      </div>
                    </div>
                    {settings.theme === theme && (
                      <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${theme === 'high-contrast' ? 'bg-accent' : 'bg-primary'}`} />
                    )}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Ajustes Tipográficos */}
          <Card id="accessibility-typography-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Type className="h-4 w-4" />
                Ajustes Tipográficos
              </CardTitle>
              <CardDescription>
                Personaliza el tamaño y espaciado del texto para mejorar la legibilidad
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tamaño de Fuente */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Type className="h-3 w-3" />
                  Tamaño de Fuente
                </Label>
                <Select value={settings.fontSize} onValueChange={handleFontSizeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">Pequeño</SelectItem>
                    <SelectItem value="md">Mediano</SelectItem>
                    <SelectItem value="lg">Grande</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Espaciado de Caracteres */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Move className="h-3 w-3" />
                  Espaciado de Caracteres
                </Label>
                <Select value={settings.letterSpacing} onValueChange={handleLetterSpacingChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="wide">Amplio</SelectItem>
                    <SelectItem value="wider">Muy Amplio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Interlineado */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <AlignLeft className="h-3 w-3" />
                  Interlineado
                </Label>
                <Select value={settings.lineHeight} onValueChange={handleLineHeightChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="relaxed">Relajado</SelectItem>
                    <SelectItem value="loose">Suelto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Funcionalidades Adicionales */}
          <Card id="accessibility-features-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="h-4 w-4" />
                Funcionalidades Adicionales
              </CardTitle>
              <CardDescription>
                Opciones especiales para mejorar la experiencia de navegación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Ocultar Imágenes */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <ImageOff className="h-3 w-3" />
                    Ocultar Imágenes
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Oculta todas las imágenes para reducir distracciones
                  </p>
                </div>
                <Switch
                  checked={settings.hideImages}
                  onCheckedChange={handleToggleImages}
                />
              </div>

              {/* Fuente para Dislexia */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Brain className="h-3 w-3" />
                    Fuente para Dislexia
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Utiliza una tipografía optimizada para personas con dislexia
                  </p>
                </div>
                <Switch
                  checked={settings.dyslexiaFont}
                  onCheckedChange={handleToggleDyslexiaFont}
                />
              </div>
            </CardContent>
          </Card>

          {/* Botón de Reset */}
          <div id="accessibility-reset-btn" className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={handleResetSettings}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Restablecer Configuración
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AccessibilityMenu;