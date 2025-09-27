import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import globals from "globals";

export default [
  // -- IGNORE --
  {
    ignores: [
      "dist",
      "node_modules",
      "coverage",
      "apps/**/dist",
      "apps/**/coverage",
      "Launcher/dist",
      "Launcher/coverage",
      "**/*.min.js",
      "frontend/node_modules/**",
      "backend/__pycache__/**",
    ],
  },

  // -- DEFAULT: browser TS/TSX --
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },

  // -- OVERRIDE: Node env for config & scripts --
  {
    files: [
      "**/*.config.{ts,js}",
      "vite.config.{ts,js}",
      "**/scripts/**/*.{ts,js}",
    ],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      "no-undef": "off",
    },
  },

  // -- OVERRIDE: Test (Vitest) --
  {
    files: ["**/*.{test,spec}.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
      globals: {
        ...globals.node,
        ...globals.jest,
        vi: "readonly",
      },
    },
  },
];
