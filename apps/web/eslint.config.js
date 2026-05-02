//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"

export default [
  {
    ignores: [".output/**", ".nitro/**", "dist/**", "node_modules/**"]
  },
  ...tanstackConfig
]
