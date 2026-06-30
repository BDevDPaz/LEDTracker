// src/context/LanguageContext.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { ensureDbReady } from '../database/db';
import { translations } from '../utils/i18n';
import { Language } from '../types';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: typeof translations['es'];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('es');

  useEffect(() => {
    const loadLang = async () => {
      try {
        const db = await ensureDbReady();
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

  const setLanguage = async (newLang: Language) => {
    try {
      const db = await ensureDbReady();
      await db.runAsync('UPDATE settings SET language = ? WHERE id = 1', [newLang]);
      setLanguageState(newLang);
    } catch (e) {
      console.error("Error guardando idioma", e);
    }
  };

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage debe usarse dentro de un LanguageProvider");
  return context;
};
