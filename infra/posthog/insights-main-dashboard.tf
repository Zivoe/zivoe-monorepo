# Main Dashboard imported from PostHog.

resource "posthog_insight" "insight_daily_active_users_daus_3119665" {
  name        = "Daily active users (DAUs)"
  description = "Shows the number of unique users that use your app every day."
  query_json = jsonencode({
    "kind" = "InsightVizNode"
    "source" = {
      "kind" = "TrendsQuery"
      "series" = [
        {
          "kind"  = "EventsNode"
          "math"  = "dau"
          "name"  = "$pageview"
          "event" = "$pageview"
        },
      ]
      "interval" = "day"
      "dateRange" = {
        "date_from"    = "-30d"
        "explicitDate" = false
      }
      "properties" = []
      "trendsFilter" = {
        "display"                 = "ActionsLineGraph"
        "showLegend"              = false
        "yAxisScaleType"          = "linear"
        "showValuesOnSeries"      = false
        "smoothingIntervals"      = 1
        "showPercentStackView"    = false
        "aggregationAxisFormat"   = "numeric"
        "showAlertThresholdLines" = false
      }
      "breakdownFilter" = {
        "breakdown_type" = "event"
      }
      "filterTestAccounts" = false
    }
  })
  dashboard_ids = [
    posthog_dashboard.dashboard_main_dashboard_464104.id,
  ]
}

resource "posthog_insight" "insight_weekly_active_users_waus_3119666" {
  name        = "Weekly active users (WAUs)"
  description = "Shows the number of unique users that use your app every week."
  query_json = jsonencode({
    "kind" = "InsightVizNode"
    "source" = {
      "kind" = "TrendsQuery"
      "series" = [
        {
          "kind"  = "EventsNode"
          "math"  = "dau"
          "name"  = "$pageview"
          "event" = "$pageview"
        },
      ]
      "interval" = "week"
      "dateRange" = {
        "date_from"    = "-90d"
        "explicitDate" = false
      }
      "properties" = []
      "trendsFilter" = {
        "display"                 = "ActionsLineGraph"
        "showLegend"              = false
        "yAxisScaleType"          = "linear"
        "showValuesOnSeries"      = false
        "smoothingIntervals"      = 1
        "showPercentStackView"    = false
        "aggregationAxisFormat"   = "numeric"
        "showAlertThresholdLines" = false
      }
      "breakdownFilter" = {
        "breakdown_type" = "event"
      }
      "filterTestAccounts" = false
    }
  })
  dashboard_ids = [
    posthog_dashboard.dashboard_main_dashboard_464104.id,
  ]
}

resource "posthog_insight" "insight_retention_3119667" {
  name        = "Retention"
  description = "Weekly retention of your users."
  query_json = jsonencode({
    "kind" = "InsightVizNode"
    "source" = {
      "kind" = "RetentionQuery"
      "dateRange" = {
        "date_from"    = "-7d"
        "explicitDate" = false
      }
      "properties" = []
      "retentionFilter" = {
        "period" = "Week"
        "targetEntity" = {
          "id"   = "$pageview"
          "type" = "events"
        }
        "retentionType"  = "retention_first_time"
        "totalIntervals" = 11
        "returningEntity" = {
          "id"   = "$pageview"
          "type" = "events"
        }
      }
      "filterTestAccounts" = false
    }
  })
  dashboard_ids = [
    posthog_dashboard.dashboard_main_dashboard_464104.id,
  ]
}

resource "posthog_insight" "insight_referring_domain_last_14_days_3119669" {
  name        = "Referring domain (last 14 days)"
  description = "Shows the most common referring domains for your users over the past 14 days."
  query_json = jsonencode({
    "kind" = "InsightVizNode"
    "source" = {
      "kind" = "TrendsQuery"
      "series" = [
        {
          "kind"  = "EventsNode"
          "math"  = "dau"
          "name"  = "$pageview"
          "event" = "$pageview"
        },
      ]
      "interval" = "day"
      "dateRange" = {
        "date_from"    = "-14d"
        "explicitDate" = false
      }
      "properties" = []
      "trendsFilter" = {
        "display"                 = "ActionsBarValue"
        "showLegend"              = false
        "yAxisScaleType"          = "linear"
        "showValuesOnSeries"      = false
        "smoothingIntervals"      = 1
        "showPercentStackView"    = false
        "aggregationAxisFormat"   = "numeric"
        "showAlertThresholdLines" = false
      }
      "breakdownFilter" = {
        "breakdown"      = "$referring_domain"
        "breakdown_type" = "event"
      }
      "filterTestAccounts" = false
    }
  })
  dashboard_ids = [
    posthog_dashboard.dashboard_main_dashboard_464104.id,
  ]
}

resource "posthog_insight" "insight_average_session_duration_by_page_3302611" {
  name        = "⭐️ Average Session Duration By Page"
  description = "This shows the average amount of time our users spend on a given page of our app."
  query_json = jsonencode({
    "kind" = "InsightVizNode"
    "source" = {
      "kind" = "TrendsQuery"
      "series" = [
        {
          "kind"          = "EventsNode"
          "math"          = "avg"
          "name"          = "$pageview"
          "event"         = "$pageview"
          "math_property" = "$session_duration"
        },
      ]
      "properties" = {
        "type" = "AND"
        "values" = [
          {
            "type" = "OR"
            "values" = [
              {
                "key"  = "$current_url"
                "type" = "event"
                "value" = [
                  "https://www.zivoe.com/",
                  "https://app.zivoe.com/",
                  "https://app.zivoe.com/portfolio",
                ]
                "operator" = "exact"
              },
            ]
          },
        ]
      }
      "trendsFilter" = {
        "display"               = "ActionsBar"
        "aggregationAxisFormat" = "duration"
      }
      "breakdownFilter" = {
        "breakdowns" = [
          {
            "type"          = "event"
            "property"      = "$current_url"
            "normalize_url" = true
          },
        ]
      }
      "filterTestAccounts" = true
    }
  })
  dashboard_ids = [
    posthog_dashboard.dashboard_main_dashboard_464104.id,
  ]
}

resource "posthog_insight" "insight_funnel_landing_page_connect_wallet_click_deposit_3302843" {
  name        = "⭐️ Funnel Landing Page -> Connect Wallet -> Click Deposit"
  description = "This funnel shows how many people went from the landing page to our app, connected their wallet, and clicked on the Deposit button. ⚠️ This funnel needs to be updated with a custom event because right now it tracks all buttons with the text \"Deposit\" including the page link \"Deposit\"."
  query_json = jsonencode({
    "kind" = "InsightVizNode"
    "source" = {
      "kind" = "FunnelsQuery"
      "series" = [
        {
          "kind"  = "EventsNode"
          "name"  = "$pageview"
          "event" = "$pageview"
          "properties" = [
            {
              "key"  = "$current_url"
              "type" = "event"
              "value" = [
                "https://www.zivoe.com/",
              ]
              "operator" = "exact"
            },
          ]
          "custom_name" = "Landing Page"
        },
        {
          "kind"  = "EventsNode"
          "name"  = "Pageview"
          "event" = "$pageview"
          "properties" = [
            {
              "key"  = "$current_url"
              "type" = "event"
              "value" = [
                "https://app.zivoe.com/",
              ]
              "operator" = "exact"
            },
          ]
          "custom_name" = "Deposit"
        },
        {
          "kind"  = "EventsNode"
          "name"  = "$autocapture"
          "event" = "$autocapture"
          "properties" = [
            {
              "key"  = "text"
              "type" = "element"
              "value" = [
                "Connect Wallet",
              ]
              "operator" = "exact"
            },
          ]
          "custom_name" = "Connect Wallet"
        },
        {
          "kind"  = "EventsNode"
          "name"  = "$autocapture"
          "event" = "$autocapture"
          "properties" = [
            {
              "key"  = "text"
              "type" = "element"
              "value" = [
                "Deposit",
              ]
              "operator" = "exact"
            },
          ]
          "custom_name" = "Deposit"
        },
      ]
      "interval" = "day"
      "dateRange" = {
        "date_to"      = null
        "date_from"    = "-30d"
        "explicitDate" = false
      }
      "funnelsFilter" = {
        "layout"        = "horizontal"
        "funnelVizType" = "steps"
      }
      "filterTestAccounts" = true
    }
  })
  dashboard_ids = [
    posthog_dashboard.dashboard_main_dashboard_464104.id,
  ]
}

resource "posthog_insight" "insight_user_stickiness_based_on_pageview_3303852" {
  name        = "⭐️ User stickiness based on Pageview"
  description = "This shows how many users come back to our site at least once per month."
  query_json = jsonencode({
    "kind" = "InsightVizNode"
    "source" = {
      "kind" = "StickinessQuery"
      "series" = [
        {
          "kind"  = "EventsNode"
          "math"  = "dau"
          "name"  = "$pageview"
          "event" = "$pageview"
        },
      ]
      "interval" = "month"
      "dateRange" = {
        "date_to"      = null
        "date_from"    = "-90d"
        "explicitDate" = false
      }
      "properties" = {
        "type"   = "AND"
        "values" = []
      }
      "compareFilter" = {
        "compare" = true
      }
      "stickinessFilter" = {
        "computedAs" = "non_cumulative"
        "stickinessCriteria" = {
          "value"    = 1
          "operator" = "gte"
        }
      }
      "filterTestAccounts" = true
    }
  })
  dashboard_ids = [
    posthog_dashboard.dashboard_main_dashboard_464104.id,
  ]
}

resource "posthog_insight" "insight_monthly_active_users_maus_3304000" {
  name        = "⭐️ Monthly active users (MAUs)"
  description = "Shows the number of unique users that use your app every month."
  query_json = jsonencode({
    "kind" = "InsightVizNode"
    "source" = {
      "kind" = "TrendsQuery"
      "series" = [
        {
          "kind"  = "EventsNode"
          "math"  = "monthly_active"
          "name"  = "$pageview"
          "event" = "$pageview"
        },
      ]
      "interval" = "day"
      "dateRange" = {
        "date_to"      = null
        "date_from"    = "-30d"
        "explicitDate" = false
      }
      "trendsFilter" = {
        "formulaNodes" = []
      }
      "filterTestAccounts" = true
    }
  })
  dashboard_ids = [
    posthog_dashboard.dashboard_main_dashboard_464104.id,
  ]
}

resource "posthog_insight" "insight_swaps_3557021" {
  name = "Swaps"
  query_json = jsonencode({
    "kind" = "InsightVizNode"
    "source" = {
      "kind" = "TrendsQuery"
      "series" = [
        {
          "kind"  = "EventsNode"
          "math"  = "total"
          "name"  = "cowswap_order_fulfilled"
          "event" = "cowswap_order_fulfilled"
        },
      ]
      "interval" = "day"
      "dateRange" = {
        "date_to"      = null
        "date_from"    = "-30d"
        "explicitDate" = false
      }
      "trendsFilter" = {}
    }
  })
  dashboard_ids = [
    posthog_dashboard.dashboard_main_dashboard_464104.id,
  ]
}
