import tseslint from 'typescript-eslint';

import { reactInternalConfig } from '@zivoe/eslint-config/react-internal.mjs';

export default reactInternalConfig({
  tsconfigRootDir: import.meta.dirname,
  tseslint,
});
