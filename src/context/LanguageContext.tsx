// src/context/LanguageContext.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { getDB } from '../database/db';
import { translations } from '../utils/i18n';
import { Language } from '../types';

// Definimos qué datos comparte este contexto
interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: typeof translations['es']; // Tipado automático de las traducciones
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('es');

  // Cargar idioma guardado al iniciar la app
  useEffect(() => {
    const loadLang = async () => {
      try {
        const db = getDB();
        const res = await db.getFirstAsync<{ language: Language }>('SELECT language FROM settings WHERE id = 1');
        if (res?.language) {
          setLanguageState(res.language);
        }
      } catch (e) {
        console.error("Error cargando idioma", e);
      }
    };
    loadLang();
  }, []);

  // Función para cambiar idioma (Guarda en DB y actualiza Estado)
  const setLanguage = async (newLang: Language) => {
    try {
      const db = getDB();
      await db.runAsync('UPDATE settings SET language = ? WHERE id = 1', [newLang]);
      setLanguageState(newLang); // Esto actualiza toda la UI inmediatamente
    } catch (e) {
      console.error("Error guardando idioma", e);
    }
  };

  // Obtener el diccionario actual
  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Hook personalizado para usar el idioma fácil en cualquier pantalla
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage debe usarse dentro de un LanguageProvider");
  return context;
};
