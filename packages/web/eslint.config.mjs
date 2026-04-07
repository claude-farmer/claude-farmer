import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  { ignores: ['.next/**'] },
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      '@next/next/no-img-element': 'off',
      // /api/auth/login은 API route이므로 <Link>가 부적절
      '@next/next/no-html-link-for-pages': 'off',
      // Material Icons 폰트는 layout.tsx에서 의도적으로 로드
      '@next/next/no-page-custom-font': 'off',
      // 픽셀 아트 캔버스 등 장식용 이미지 허용
      'jsx-a11y/alt-text': 'off',
    },
  },
];

export default config;
