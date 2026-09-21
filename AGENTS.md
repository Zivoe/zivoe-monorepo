# Zivoe monorepo

- Sign in to the dapp as the agent, locally or on a Vercel preview: [docs/runbooks/agent-sign-in.md](docs/runbooks/agent-sign-in.md).

## Direct Vercel production deployments require an explicit Yes

- Use the established GitHub release workflow by default.
- Before every direct Vercel production deployment, finish the implementation and verification, identify the exact changes and target project/domain, then ask the user a direct question: "May I deploy [these specific changes] directly to Vercel production for [project/domain] now? Please answer Yes to approve."
- Wait for the user to answer that question explicitly with "Yes" before performing the deployment. General requests to implement, fix, publish, or deploy; earlier blanket authorization; silence; and tool/sandbox approval do not satisfy this requirement.
- Approval applies only to that specific deployment and target. Ask again for another deployment, another target, or materially changed code. Do not reuse a previous Yes.
- This requirement covers CLI, API, and dashboard actions that put code into production, including `vercel deploy --prod`, promotions, redeployments, and production alias/domain changes. Do not bypass it through another tool or method.
- If GitHub, signing, or pushing is blocked, report the blocker. Do not silently deploy a local or uncommitted source snapshot as a workaround. A direct deployment remains possible only after the question and explicit Yes above.
- Approval for a code deployment does not authorize production database writes, migrations, or configuration changes; obtain explicit authorization for those separately.
