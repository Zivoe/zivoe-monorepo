# PostHog dashboards managed by this Terraform root.

resource "posthog_dashboard" "dashboard_main_dashboard_464104" {
  name   = "Main Dashboard"
  pinned = true
}

resource "posthog_dashboard" "zivoe_dapp_activation_funnel" {
  name        = "Zivoe Dapp - Activation Funnel"
  description = "Tracks user drop-off, transaction lifecycle health, confirmed volume, and authorization friction."
  tags        = ["terraform", "dapp", "activation"]
}
