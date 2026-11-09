import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config({ignores:['dist/**','node_modules/**','content-private/**','public/**']},js.configs.recommended,...ts.configs.recommended,{files:['**/*.{ts,tsx,js,mjs}'],languageOptions:{globals:{process:'readonly',console:'readonly',document:'readonly',window:'readonly',setTimeout:'readonly',URL:'readonly',Buffer:'readonly'}},rules:{'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}});
