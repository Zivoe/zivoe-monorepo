# Zivoe Web Monorepo

This is the monorepo for the Zivoe websites [zivoe.com](https://zivoe.com) and [app.zivoe.com](https://app.zivoe.com), built with [Turborepo](https://turbo.build/repo) and managed using [pnpm workspaces](https://pnpm.io/workspaces). It includes the dApp, landing site, design system, and shared packages used across all sites.

---

## 📁 Structure

```
.
├── apps/                # Frontend applications
│   ├── dapp             # Zivoe main dApp frontend
│   ├── landing          # Marketing/landing website
│   └── storybook        # Design system preview using Storybook
│
├── packages/            # Shared packages
│   ├── contracts        # Smart contract ABIs and utilities
│   ├── eslint           # Shared linting config
│   ├── prettier         # Shared prettier config
│   └── typescript       # Shared TS config
│   └── ui               # Shared UI component library
│
├── .vscode/             # Editor settings
├── .gitignore
├── package.json         # Root project metadata
├── pnpm-workspace.yaml  # Workspace configuration
├── turbo.json           # Turborepo pipeline config
└── README.md
```

---

## 📦 Tech Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Frontend:** Next.js + TailwindCSS
- **Contracts:** ABIs managed in `/packages/contracts`
- **Tooling:** Eslint, Prettier, Storybook
- **Deployment:** Vercel / Custom

---

## 📄 License

All rights reserved by Zivoe Labs.
