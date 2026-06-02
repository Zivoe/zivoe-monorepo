# PostHog Terraform

This Terraform root manages PostHog dashboards, insights, and dashboard layouts. Existing dashboards must be imported into Terraform state before Terraform manages them. Do not hand-write a `posthog_dashboard_layout` for a live dashboard unless the dashboard was already imported and the plan shows the expected tile set.

## Requirements

- Terraform 1.5 or newer.
- A PostHog personal API key.
- `POSTHOG_PROJECT_ID` for the target PostHog project/environment.

Set credentials in your shell. Do not commit them.

```bash
export POSTHOG_API_KEY="phx_..."
export POSTHOG_HOST="https://us.posthog.com"
export POSTHOG_PROJECT_ID="12345"
```

The Terraform provider reads `POSTHOG_API_KEY`.

## Validate Terraform

Install the provider:

```bash
terraform init
```

Review changes:

```bash
terraform plan
```

The plan should report no unexpected changes. If the plan includes dashboard layout changes or destroys, stop and inspect the affected resources before applying.

```bash
terraform apply
```

## File Layout

Dashboard resources are defined in `dashboards.tf`. Dashboard-specific insights and layouts live in separate files.

- `dashboards.tf`
- `insights-main-dashboard.tf`
- `layouts-main-dashboard.tf`
- `activation-funnel.tf`

## Layout Risk

`posthog_dashboard_layout` is authoritative. When applied, unmanaged text tiles are deleted and unmanaged insight tile layouts are cleared. Import the layout first, keep a JSON backup, and review every layout diff before applying.
