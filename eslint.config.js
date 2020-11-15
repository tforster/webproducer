import globals from "globals";
import js from "@eslint/js";
import { fixupPluginRules } from "@eslint/compat";

// Plugins
import _import from "eslint-plugin-import";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import markdown from "@eslint/markdown";
import json from "@eslint/json";
import html from "eslint-plugin-html";
import node from "eslint-plugin-node";

export default [
  js.configs.recommended,
  eslintPluginPrettierRecommended,

  {
    plugins: {
      import: fixupPluginRules(_import),
      node,
      json,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.amd,
      },

      ecmaVersion: "latest",
      sourceType: "module",

      parserOptions: {
        ecmaFeatures: {
          impliedStrict: true,
          classes: true,
        },
      },
    },
    rules: {
      // Set to off so that it does not conflict with markdown linting
      "no-irregular-whitespace": "off",
      "no-undef": "error",
      "class-methods-use-this": "off",
      "no-throw-literal": "off",
      "no-debugger": 0,
      "no-alert": 0,
      "no-await-in-loop": 0,
      "no-return-assign": ["error", "except-parens"],
      "no-restricted-syntax": [2, "ForInStatement", "LabeledStatement", "WithStatement"],
      "no-unreachable": [0],
      "no-unused-vars": [
        1,
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: "res|next|^err",
        },
      ],
      "prefer-const": [
        "error",
        {
          destructuring: "all",
        },
      ],
      "arrow-body-style": [2, "as-needed"],
      "no-unused-expressions": [
        2,
        {
          allowTaggedTemplates: true,
        },
      ],
      "no-const-assign": 0,
      "no-param-reassign": "off",
      "no-console": 1,

      "space-before-function-paren": 0,
      "comma-dangle": 0,
      "max-len": [
        "error",
        {
          code: 132,
        },
      ],
      "no-underscore-dangle": 0,
      "consistent-return": 0,
      radix: 0,
      "no-shadow": [
        2,
        {
          hoist: "all",
          allow: ["resolve", "reject", "done", "next", "err", "error"],
        },
      ],
      quotes: [
        2,
        "double",
        {
          avoidEscape: true,
          allowTemplateLiterals: true,
        },
      ],
    },
    "import/extensions": [
      "error",
      "ignorePackages", // This ignores extensions for packages
      {
        js: "never",
        jsx: "never",
        ts: "never",
        tsx: "never",
        json: "always", // Add this to allow JSON extensions
      },
    ],
  },
  {
    name: "html",
    files: ["**/*.html"],
    plugins: {
      html,
    },
  },
  {
    name: "markdown",
    files: ["**/*.md"],
    plugins: {
      markdown,
    },
    language: "markdown/gfm",
    rules: {
      "markdown/no-html": "error",
      "markdown/heading-increment": "error",
      "markdown/fenced-code-language": "error",
    },
  },
];
