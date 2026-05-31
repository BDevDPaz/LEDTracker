// --- eslint.config.js ---
// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// Cargar plugin de React Compiler
const reactCompiler = require('eslint-plugin-react-compiler');

module.exports = defineConfig([
  ...(Array.isArray(expoConfig) ? expoConfig : [expoConfig]),
  {
    ignores: ['dist/*'],
  },
  {
    plugins: {
      'react-compiler': reactCompiler,
    },
    rules: {
      // Forzar que el código cumpla con las reglas del React Compiler
      'react-compiler/react-compiler': 'error',
      
      // Apagar reglas legacy de hooks que entran en conflicto con el compilador
      'react-hooks/exhaustive-deps': 'off',
      
      // Asegurar que las entidades en JSX estén escapadas de forma segura (Ej. &apos;)
      'react/no-unescaped-entities': 'error',

      // Permitir variables muertas/no usadas solo si tienen prefijo "_"
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
]);

