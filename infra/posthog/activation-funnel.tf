# Zivoe dapp activation funnel.
# Tracks completed milestones so PostHog can show drop-off between each step.

moved {
  from = posthog_insight.zivoe_dapp_activation_funnel
  to   = posthog_insight.zivoe_dapp_activation_approval_path
}

resource "posthog_insight" "zivoe_dapp_activation_all_deposits" {
  name        = "Zivoe Dapp - Activation Funnel - All Deposits"
  description = "Drop-off from sign-up through onboarding start, onboarding completion, wallet connection, deposit start, and UI deposit receipt. Server-confirmed on-chain deposits are tracked in the Deposit Receipt vs Confirmed and Deposit Lifecycle insights (their on-chain timestamps precede the client receipt, so they are not funnel steps)."
  tags        = ["terraform", "dapp", "activation"]

  query_json = jsonencode({
    kind = "InsightVizNode"
    source = {
      kind     = "FunnelsQuery"
      interval = "day"

      dateRange = {
        date_from    = "-30d"
        date_to      = null
        explicitDate = false
      }

      filterTestAccounts = true

      funnelsFilter = {
        funnelVizType = "steps"
        layout        = "horizontal"
      }

      series = [
        {
          kind        = "EventsNode"
          event       = "auth:sign-up"
          name        = "auth:sign-up"
          custom_name = "Sign-up"
        },
        {
          kind        = "EventsNode"
          event       = "onboarding:started"
          name        = "onboarding:started"
          custom_name = "Onboarding started"
        },
        {
          kind        = "EventsNode"
          event       = "onboarding:completed"
          name        = "onboarding:completed"
          custom_name = "Onboarding completed"
        },
        {
          kind        = "EventsNode"
          event       = "wallet_connected"
          name        = "wallet_connected"
          custom_name = "Wallet connected"
        },
        {
          kind        = "EventsNode"
          event       = "tx:deposit_started"
          name        = "tx:deposit_started"
          custom_name = "Deposit started"
        },
        {
          kind        = "EventsNode"
          event       = "tx:deposit_receipt"
          name        = "tx:deposit_receipt"
          custom_name = "Deposit receipt"
        },
      ]
    }
  })

  dashboard_ids = [
    posthog_dashboard.zivoe_dapp_activation_funnel.id,
  ]
}

resource "posthog_insight" "zivoe_dapp_activation_approval_path" {
  name        = "Zivoe Dapp - Activation Funnel - Approval Path"
  description = "Drop-off from sign-up through onboarding, wallet connection, token approval, deposit start, and UI deposit receipt for users who need ERC-20 approval. This excludes permit-only deposits and users with existing allowance."
  tags        = ["terraform", "dapp", "activation", "approval"]

  query_json = jsonencode({
    kind = "InsightVizNode"
    source = {
      kind     = "FunnelsQuery"
      interval = "day"

      dateRange = {
        date_from    = "-30d"
        date_to      = null
        explicitDate = false
      }

      filterTestAccounts = true

      funnelsFilter = {
        funnelVizType = "steps"
        layout        = "horizontal"
      }

      series = [
        {
          kind        = "EventsNode"
          event       = "auth:sign-up"
          name        = "auth:sign-up"
          custom_name = "Sign-up"
        },
        {
          kind        = "EventsNode"
          event       = "onboarding:started"
          name        = "onboarding:started"
          custom_name = "Onboarding started"
        },
        {
          kind        = "EventsNode"
          event       = "onboarding:completed"
          name        = "onboarding:completed"
          custom_name = "Onboarding completed"
        },
        {
          kind        = "EventsNode"
          event       = "wallet_connected"
          name        = "wallet_connected"
          custom_name = "Wallet connected"
        },
        {
          kind        = "EventsNode"
          event       = "tx:approval_confirmed"
          name        = "tx:approval_confirmed"
          custom_name = "Token approved"
        },
        {
          kind        = "EventsNode"
          event       = "tx:deposit_started"
          name        = "tx:deposit_started"
          custom_name = "Deposit started"
        },
        {
          kind        = "EventsNode"
          event       = "tx:deposit_receipt"
          name        = "tx:deposit_receipt"
          custom_name = "Deposit receipt"
        },
      ]
    }
  })

  dashboard_ids = [
    posthog_dashboard.zivoe_dapp_activation_funnel.id,
  ]
}

resource "posthog_insight" "zivoe_dapp_deposit_receipt_vs_confirmed" {
  name        = "Zivoe Dapp - Deposit Receipt vs Confirmed"
  description = "Compares client-side successful deposit receipts with server-side monitor confirmations."
  tags        = ["terraform", "dapp", "deposit", "reliability"]

  query_json = jsonencode({
    kind = "InsightVizNode"
    source = {
      kind     = "TrendsQuery"
      interval = "day"

      dateRange = {
        date_from    = "-30d"
        date_to      = null
        explicitDate = false
      }

      filterTestAccounts = true

      series = [
        {
          kind        = "EventsNode"
          event       = "tx:deposit_receipt"
          name        = "tx:deposit_receipt"
          custom_name = "Deposit receipt"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "tx:deposit_confirmed"
          name        = "tx:deposit_confirmed"
          custom_name = "Deposit confirmed by monitor"
          math        = "total"
        },
      ]

      trendsFilter = {
        display                 = "ActionsLineGraph"
        aggregationAxisFormat   = "numeric"
        showAlertThresholdLines = false
        showLegend              = true
        showPercentStackView    = false
        showValuesOnSeries      = false
        smoothingIntervals      = 1
        yAxisScaleType          = "linear"
      }
    }
  })

  dashboard_ids = [
    posthog_dashboard.zivoe_dapp_activation_funnel.id,
  ]
}

resource "posthog_insight" "zivoe_dapp_otp_activity" {
  name        = "Zivoe Dapp - OTP Activity"
  description = "Tracks email OTP requests and resends separately from the authenticated signup funnel."
  tags        = ["terraform", "dapp", "auth", "otp"]

  query_json = jsonencode({
    kind = "InsightVizNode"
    source = {
      kind     = "TrendsQuery"
      interval = "day"

      dateRange = {
        date_from    = "-30d"
        date_to      = null
        explicitDate = false
      }

      filterTestAccounts = true

      series = [
        {
          kind        = "EventsNode"
          event       = "auth:otp_requested"
          name        = "auth:otp_requested"
          custom_name = "OTP requested"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "auth:otp_resent"
          name        = "auth:otp_resent"
          custom_name = "OTP resent"
          math        = "total"
        },
      ]

      trendsFilter = {
        display                 = "ActionsLineGraph"
        aggregationAxisFormat   = "numeric"
        showAlertThresholdLines = false
        showLegend              = true
        showPercentStackView    = false
        showValuesOnSeries      = false
        smoothingIntervals      = 1
        yAxisScaleType          = "linear"
      }
    }
  })

  dashboard_ids = [
    posthog_dashboard.zivoe_dapp_activation_funnel.id,
  ]
}

resource "posthog_insight" "zivoe_dapp_deposit_lifecycle" {
  name        = "Zivoe Dapp - Deposit Lifecycle"
  description = "Compares deposit starts, submissions, receipts, monitor confirmations, rejections, and failures."
  tags        = ["terraform", "dapp", "deposit", "lifecycle"]

  query_json = jsonencode({
    kind = "InsightVizNode"
    source = {
      kind     = "TrendsQuery"
      interval = "day"

      dateRange = {
        date_from    = "-30d"
        date_to      = null
        explicitDate = false
      }

      filterTestAccounts = true

      series = [
        {
          kind        = "EventsNode"
          event       = "tx:deposit_started"
          name        = "tx:deposit_started"
          custom_name = "Deposit started"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "tx:deposit_submitted"
          name        = "tx:deposit_submitted"
          custom_name = "Deposit submitted"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "tx:deposit_receipt"
          name        = "tx:deposit_receipt"
          custom_name = "Deposit receipt"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "tx:deposit_confirmed"
          name        = "tx:deposit_confirmed"
          custom_name = "Deposit confirmed by monitor"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "tx:deposit_signature_rejected"
          name        = "tx:deposit_signature_rejected"
          custom_name = "Deposit signature rejected"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "tx:deposit_failed"
          name        = "tx:deposit_failed"
          custom_name = "Deposit failed"
          math        = "total"
        },
      ]

      trendsFilter = {
        display                 = "ActionsLineGraph"
        aggregationAxisFormat   = "numeric"
        showAlertThresholdLines = false
        showLegend              = true
        showPercentStackView    = false
        showValuesOnSeries      = false
        smoothingIntervals      = 1
        yAxisScaleType          = "linear"
      }
    }
  })

  dashboard_ids = [
    posthog_dashboard.zivoe_dapp_activation_funnel.id,
  ]
}

resource "posthog_insight" "zivoe_dapp_redemption_lifecycle" {
  name        = "Zivoe Dapp - Redemption Lifecycle"
  description = "Compares redemption starts, submissions, receipts, monitor confirmations, rejections, and failures."
  tags        = ["terraform", "dapp", "redemption", "lifecycle"]

  query_json = jsonencode({
    kind = "InsightVizNode"
    source = {
      kind     = "TrendsQuery"
      interval = "day"

      dateRange = {
        date_from    = "-30d"
        date_to      = null
        explicitDate = false
      }

      filterTestAccounts = true

      series = [
        {
          kind        = "EventsNode"
          event       = "tx:redeem_started"
          name        = "tx:redeem_started"
          custom_name = "Redeem started"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "tx:redeem_submitted"
          name        = "tx:redeem_submitted"
          custom_name = "Redeem submitted"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "tx:redeem_receipt"
          name        = "tx:redeem_receipt"
          custom_name = "Redeem receipt"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "tx:redeem_confirmed"
          name        = "tx:redeem_confirmed"
          custom_name = "Redeem confirmed by monitor"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "tx:redeem_signature_rejected"
          name        = "tx:redeem_signature_rejected"
          custom_name = "Redeem signature rejected"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "tx:redeem_failed"
          name        = "tx:redeem_failed"
          custom_name = "Redeem failed"
          math        = "total"
        },
      ]

      trendsFilter = {
        display                 = "ActionsLineGraph"
        aggregationAxisFormat   = "numeric"
        showAlertThresholdLines = false
        showLegend              = true
        showPercentStackView    = false
        showValuesOnSeries      = false
        smoothingIntervals      = 1
        yAxisScaleType          = "linear"
      }
    }
  })

  dashboard_ids = [
    posthog_dashboard.zivoe_dapp_activation_funnel.id,
  ]
}

resource "posthog_insight" "zivoe_dapp_confirmed_deposit_volume_by_token" {
  name        = "Zivoe Dapp - Confirmed Deposit Volume by Token"
  description = "Sums confirmed deposit output volume in zVLT, broken down by input token."
  tags        = ["terraform", "dapp", "deposit", "volume"]

  query_json = jsonencode({
    kind = "InsightVizNode"
    source = {
      kind     = "TrendsQuery"
      interval = "day"

      dateRange = {
        date_from    = "-30d"
        date_to      = null
        explicitDate = false
      }

      filterTestAccounts = true

      series = [
        {
          kind        = "EventsNode"
          event       = "tx:deposit_confirmed"
          name        = "tx:deposit_confirmed"
          custom_name = "Confirmed deposit volume"
          math        = "hogql"
          math_hogql  = "sum(toFloat(properties.amount_out_raw) / 1000000000000000000)"
        },
      ]

      breakdownFilter = {
        breakdown      = "token_in"
        breakdown_type = "event"
      }

      trendsFilter = {
        display                 = "ActionsBarValue"
        aggregationAxisFormat   = "numeric"
        showAlertThresholdLines = false
        showLegend              = true
        showPercentStackView    = false
        showValuesOnSeries      = true
        smoothingIntervals      = 1
        yAxisScaleType          = "linear"
      }
    }
  })

  dashboard_ids = [
    posthog_dashboard.zivoe_dapp_activation_funnel.id,
  ]
}

resource "posthog_insight" "zivoe_dapp_confirmed_redemption_volume" {
  name        = "Zivoe Dapp - Confirmed Redemption Volume"
  description = "Sums confirmed redemption output volume in USDC."
  tags        = ["terraform", "dapp", "redemption", "volume"]

  query_json = jsonencode({
    kind = "InsightVizNode"
    source = {
      kind     = "TrendsQuery"
      interval = "day"

      dateRange = {
        date_from    = "-30d"
        date_to      = null
        explicitDate = false
      }

      filterTestAccounts = true

      series = [
        {
          kind        = "EventsNode"
          event       = "tx:redeem_confirmed"
          name        = "tx:redeem_confirmed"
          custom_name = "Confirmed redemption volume"
          math        = "hogql"
          math_hogql  = "sum(toFloat(properties.amount_out_raw) / 1000000)"
        },
      ]

      trendsFilter = {
        display                 = "ActionsLineGraph"
        aggregationAxisFormat   = "numeric"
        showAlertThresholdLines = false
        showLegend              = true
        showPercentStackView    = false
        showValuesOnSeries      = false
        smoothingIntervals      = 1
        yAxisScaleType          = "linear"
      }
    }
  })

  dashboard_ids = [
    posthog_dashboard.zivoe_dapp_activation_funnel.id,
  ]
}

# The monitor-confirmed volume insights above retain the legacy protocol's
# history. These receipt insights track the replacement Centrifuge flows.
resource "posthog_insight" "zivoe_dapp_centrifuge_deposit_receipt_volume_by_vault" {
  name        = "Zivoe Dapp - Centrifuge Deposit Receipt Share Volume by Vault"
  description = "Sums successful Centrifuge deposit receipt output volume in vault shares, broken down by output token."
  tags        = ["terraform", "dapp", "centrifuge", "deposit", "volume"]

  query_json = jsonencode({
    kind = "InsightVizNode"
    source = {
      kind     = "TrendsQuery"
      interval = "day"

      dateRange = {
        date_from    = "-30d"
        date_to      = null
        explicitDate = false
      }

      filterTestAccounts = true

      series = [
        {
          kind        = "EventsNode"
          event       = "tx:deposit_receipt"
          name        = "tx:deposit_receipt"
          custom_name = "Deposit receipt share volume"
          math        = "hogql"
          math_hogql  = "sum(toFloat(properties.amount_out_raw) / 1000000000000000000)"
          properties = [
            {
              key      = "token_out"
              type     = "event"
              value    = ["zSMB", "zALT"]
              operator = "exact"
            },
          ]
        },
      ]

      breakdownFilter = {
        breakdown      = "token_out"
        breakdown_type = "event"
      }

      trendsFilter = {
        display                 = "ActionsBarValue"
        aggregationAxisFormat   = "numeric"
        showAlertThresholdLines = false
        showLegend              = true
        showPercentStackView    = false
        showValuesOnSeries      = true
        smoothingIntervals      = 1
        yAxisScaleType          = "linear"
      }
    }
  })

  dashboard_ids = [
    posthog_dashboard.zivoe_dapp_activation_funnel.id,
  ]
}

resource "posthog_insight" "zivoe_dapp_centrifuge_redemption_claim_volume_by_vault" {
  name        = "Zivoe Dapp - Centrifuge Redemption Claim Volume by Vault"
  description = "Sums successful Centrifuge redemption claim receipt output volume in USDC, broken down by input vault token."
  tags        = ["terraform", "dapp", "centrifuge", "redemption", "volume"]

  query_json = jsonencode({
    kind = "InsightVizNode"
    source = {
      kind     = "TrendsQuery"
      interval = "day"

      dateRange = {
        date_from    = "-30d"
        date_to      = null
        explicitDate = false
      }

      filterTestAccounts = true

      series = [
        {
          kind        = "EventsNode"
          event       = "tx:redeem_claim_receipt"
          name        = "tx:redeem_claim_receipt"
          custom_name = "Redemption claim volume"
          math        = "hogql"
          math_hogql  = "sum(toFloat(properties.amount_out_raw) / 1000000)"
        },
      ]

      breakdownFilter = {
        breakdown      = "token_in"
        breakdown_type = "event"
      }

      trendsFilter = {
        display                 = "ActionsLineGraph"
        aggregationAxisFormat   = "numeric"
        showAlertThresholdLines = false
        showLegend              = true
        showPercentStackView    = false
        showValuesOnSeries      = false
        smoothingIntervals      = 1
        yAxisScaleType          = "linear"
      }
    }
  })

  dashboard_ids = [
    posthog_dashboard.zivoe_dapp_activation_funnel.id,
  ]
}

resource "posthog_insight" "zivoe_dapp_authorization_friction" {
  name        = "Zivoe Dapp - Authorization Friction"
  description = "Compares approval and permit starts, successes, signature rejections, and failures. Approval events can come from deposit or redemption allowance flows; permit events are deposit-only."
  tags        = ["terraform", "dapp", "authorization", "deposit", "redemption"]

  query_json = jsonencode({
    kind = "InsightVizNode"
    source = {
      kind     = "TrendsQuery"
      interval = "day"

      dateRange = {
        date_from    = "-30d"
        date_to      = null
        explicitDate = false
      }

      filterTestAccounts = true

      series = [
        {
          kind        = "EventsNode"
          event       = "tx:approval_started"
          name        = "tx:approval_started"
          custom_name = "Approval started"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "tx:approval_submitted"
          name        = "tx:approval_submitted"
          custom_name = "Approval submitted"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "tx:approval_confirmed"
          name        = "tx:approval_confirmed"
          custom_name = "Approval confirmed"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "tx:approval_signature_rejected"
          name        = "tx:approval_signature_rejected"
          custom_name = "Approval signature rejected"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "tx:approval_failed"
          name        = "tx:approval_failed"
          custom_name = "Approval failed"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "tx:permit_started"
          name        = "tx:permit_started"
          custom_name = "Permit started"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "tx:permit_signed"
          name        = "tx:permit_signed"
          custom_name = "Permit signed"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "tx:permit_signature_rejected"
          name        = "tx:permit_signature_rejected"
          custom_name = "Permit signature rejected"
          math        = "total"
        },
        {
          kind        = "EventsNode"
          event       = "tx:permit_failed"
          name        = "tx:permit_failed"
          custom_name = "Permit failed"
          math        = "total"
        },
      ]

      trendsFilter = {
        display                 = "ActionsBarValue"
        aggregationAxisFormat   = "numeric"
        showAlertThresholdLines = false
        showLegend              = true
        showPercentStackView    = false
        showValuesOnSeries      = true
        smoothingIntervals      = 1
        yAxisScaleType          = "linear"
      }
    }
  })

  dashboard_ids = [
    posthog_dashboard.zivoe_dapp_activation_funnel.id,
  ]
}

resource "posthog_dashboard_layout" "zivoe_dapp_activation_funnel" {
  dashboard_id = posthog_dashboard.zivoe_dapp_activation_funnel.id

  tiles = [
    {
      insight_id       = posthog_insight.zivoe_dapp_activation_all_deposits.id
      show_description = true
      layouts_json = jsonencode({
        sm = {
          h    = 8
          minH = 4
          minW = 4
          w    = 6
          x    = 0
          y    = 0
        }
        xs = {
          h    = 8
          minH = 4
          minW = 1
          w    = 1
          x    = 0
          y    = 0
        }
      })
    },
    {
      insight_id       = posthog_insight.zivoe_dapp_activation_approval_path.id
      show_description = true
      layouts_json = jsonencode({
        sm = {
          h    = 8
          minH = 4
          minW = 4
          w    = 6
          x    = 6
          y    = 0
        }
        xs = {
          h    = 8
          minH = 4
          minW = 1
          w    = 1
          x    = 0
          y    = 8
        }
      })
    },
    {
      insight_id       = posthog_insight.zivoe_dapp_otp_activity.id
      show_description = true
      layouts_json = jsonencode({
        sm = {
          h    = 6
          minH = 4
          minW = 4
          w    = 12
          x    = 0
          y    = 8
        }
        xs = {
          h    = 6
          minH = 4
          minW = 1
          w    = 1
          x    = 0
          y    = 16
        }
      })
    },
    {
      insight_id       = posthog_insight.zivoe_dapp_deposit_lifecycle.id
      show_description = true
      layouts_json = jsonencode({
        sm = {
          h    = 6
          minH = 4
          minW = 4
          w    = 6
          x    = 0
          y    = 14
        }
        xs = {
          h    = 6
          minH = 4
          minW = 1
          w    = 1
          x    = 0
          y    = 22
        }
      })
    },
    {
      insight_id       = posthog_insight.zivoe_dapp_redemption_lifecycle.id
      show_description = true
      layouts_json = jsonencode({
        sm = {
          h    = 6
          minH = 4
          minW = 4
          w    = 6
          x    = 6
          y    = 14
        }
        xs = {
          h    = 6
          minH = 4
          minW = 1
          w    = 1
          x    = 0
          y    = 28
        }
      })
    },
    {
      insight_id       = posthog_insight.zivoe_dapp_deposit_receipt_vs_confirmed.id
      show_description = true
      layouts_json = jsonencode({
        sm = {
          h    = 6
          minH = 4
          minW = 4
          w    = 12
          x    = 0
          y    = 20
        }
        xs = {
          h    = 6
          minH = 4
          minW = 1
          w    = 1
          x    = 0
          y    = 34
        }
      })
    },
    {
      insight_id       = posthog_insight.zivoe_dapp_confirmed_deposit_volume_by_token.id
      show_description = true
      layouts_json = jsonencode({
        sm = {
          h    = 6
          minH = 4
          minW = 4
          w    = 6
          x    = 0
          y    = 26
        }
        xs = {
          h    = 6
          minH = 4
          minW = 1
          w    = 1
          x    = 0
          y    = 40
        }
      })
    },
    {
      insight_id       = posthog_insight.zivoe_dapp_confirmed_redemption_volume.id
      show_description = true
      layouts_json = jsonencode({
        sm = {
          h    = 6
          minH = 4
          minW = 4
          w    = 6
          x    = 6
          y    = 26
        }
        xs = {
          h    = 6
          minH = 4
          minW = 1
          w    = 1
          x    = 0
          y    = 46
        }
      })
    },
    {
      insight_id       = posthog_insight.zivoe_dapp_authorization_friction.id
      show_description = true
      layouts_json = jsonencode({
        sm = {
          h    = 6
          minH = 4
          minW = 4
          w    = 12
          x    = 0
          y    = 32
        }
        xs = {
          h    = 6
          minH = 4
          minW = 1
          w    = 1
          x    = 0
          y    = 52
        }
      })
    },
    {
      insight_id       = posthog_insight.zivoe_dapp_centrifuge_deposit_receipt_volume_by_vault.id
      show_description = true
      layouts_json = jsonencode({
        sm = {
          h    = 6
          minH = 4
          minW = 4
          w    = 6
          x    = 0
          y    = 38
        }
        xs = {
          h    = 6
          minH = 4
          minW = 1
          w    = 1
          x    = 0
          y    = 58
        }
      })
    },
    {
      insight_id       = posthog_insight.zivoe_dapp_centrifuge_redemption_claim_volume_by_vault.id
      show_description = true
      layouts_json = jsonencode({
        sm = {
          h    = 6
          minH = 4
          minW = 4
          w    = 6
          x    = 6
          y    = 38
        }
        xs = {
          h    = 6
          minH = 4
          minW = 1
          w    = 1
          x    = 0
          y    = 64
        }
      })
    },
  ]
}
