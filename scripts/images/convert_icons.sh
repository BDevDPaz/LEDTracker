#!/bin/bash
echo "🔵 Iniciando proceso de conversión..."

if ! command -v magick &> /dev/null
then
    echo "🟡 ImageMagick no está instalado. Instalando..."
    pkg update -y
    pkg install imagemagick -y
fi

echo "🧹 Eliminando PNGs antiguos en assets/images/..."
rm -f assets/images/icon.png
rm -f assets/images/adaptive-icon.png
rm -f assets/images/splash.png
rm -f assets/images/splash-icon.png

echo "⚙️ Convirtiendo Icono Principal..."
magick -background none scripts/images/svg/icon.svg -resize 1024x1024 assets/images/icon.png

echo "⚙️ Convirtiendo Icono Adaptativo..."
magick -background none scripts/images/svg/adaptive-icon.svg -resize 1024x1024 assets/images/adaptive-icon.png

echo "⚙️ Convirtiendo Splash Screen Completo..."
magick -background none scripts/images/svg/splash.svg -resize 1080x1920 assets/images/splash.png

echo "⚙️ Convirtiendo Splash Icon Centrado..."
magick -background none scripts/images/svg/splash-icon.svg -resize 800x800 assets/images/splash-icon.png

echo "🟢 ¡Listo! Las nuevas imágenes Dark Glass están en assets/images/"
