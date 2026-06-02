# Main Dashboard imported from PostHog.

resource "posthog_dashboard_layout" "dashboard_layout_main_dashboard_464104" {
  dashboard_id = posthog_dashboard.dashboard_main_dashboard_464104.id
  tiles = [
    {
      insight_id = 3304000
      layouts_json = jsonencode({
        "sm" = {
          "h"      = 5
          "i"      = "2605852"
          "w"      = 12
          "x"      = 0
          "y"      = 0
          "minH"   = 1
          "minW"   = 1
          "moved"  = false
          "static" = false
        }
        "xs" = {
          "h"    = 5
          "i"    = "2605852"
          "w"    = 1
          "x"    = 0
          "y"    = 45
          "minH" = 1
          "minW" = 1
        }
      })
    },
    {
      insight_id = 3119665
      layouts_json = jsonencode({
        "sm" = {
          "h"      = 5
          "i"      = "2416283"
          "w"      = 6
          "x"      = 0
          "y"      = 5
          "minH"   = 1
          "minW"   = 1
          "moved"  = false
          "static" = false
        }
        "xs" = {
          "h"    = 5
          "i"    = "2416283"
          "w"    = 1
          "x"    = 0
          "y"    = 0
          "minH" = 1
          "minW" = 1
        }
      })
      color = "blue"
    },
    {
      insight_id = 3119666
      layouts_json = jsonencode({
        "sm" = {
          "h"      = 5
          "i"      = "2416284"
          "w"      = 6
          "x"      = 6
          "y"      = 5
          "minH"   = 1
          "minW"   = 1
          "moved"  = false
          "static" = false
        }
        "xs" = {
          "h"    = 5
          "i"    = "2416284"
          "w"    = 1
          "x"    = 0
          "y"    = 5
          "minH" = 1
          "minW" = 1
        }
      })
      color = "green"
    },
    {
      insight_id = 3303852
      layouts_json = jsonencode({
        "sm" = {
          "h"      = 5
          "i"      = "2605718"
          "w"      = 6
          "x"      = 0
          "y"      = 10
          "minH"   = 1
          "minW"   = 1
          "moved"  = false
          "static" = false
        }
        "xs" = {
          "h"    = 5
          "i"    = "2605718"
          "w"    = 1
          "x"    = 0
          "y"    = 30
          "minH" = 1
          "minW" = 1
        }
      })
    },
    {
      insight_id = 3119667
      layouts_json = jsonencode({
        "sm" = {
          "h"      = 5
          "i"      = "2416285"
          "w"      = 6
          "x"      = 6
          "y"      = 10
          "minH"   = 1
          "minW"   = 1
          "moved"  = false
          "static" = false
        }
        "xs" = {
          "h"    = 5
          "i"    = "2416285"
          "w"    = 1
          "x"    = 0
          "y"    = 10
          "minH" = 1
          "minW" = 1
        }
      })
      color = "blue"
    },
    {
      insight_id = 3119669
      layouts_json = jsonencode({
        "sm" = {
          "h"      = 5
          "i"      = "2416287"
          "w"      = 6
          "x"      = 0
          "y"      = 15
          "minH"   = 1
          "minW"   = 1
          "moved"  = false
          "static" = false
        }
        "xs" = {
          "h"    = 5
          "i"    = "2416287"
          "w"    = 1
          "x"    = 0
          "y"    = 20
          "minH" = 1
          "minW" = 1
        }
      })
      color = "black"
    },
    {
      insight_id = 3302611
      layouts_json = jsonencode({
        "sm" = {
          "h"      = 7
          "i"      = "2605513"
          "w"      = 6
          "x"      = 0
          "y"      = 20
          "minH"   = 1
          "minW"   = 1
          "moved"  = false
          "static" = false
        }
        "xs" = {
          "h"    = 5
          "i"    = "2605513"
          "w"    = 1
          "x"    = 0
          "y"    = 40
          "minH" = 1
          "minW" = 1
        }
      })
    },
    {
      insight_id = 3302843
      layouts_json = jsonencode({
        "sm" = {
          "h"      = 7
          "i"      = "2605514"
          "w"      = 6
          "x"      = 6
          "y"      = 20
          "minH"   = 1
          "minW"   = 1
          "moved"  = false
          "static" = false
        }
        "xs" = {
          "h"    = 5
          "i"    = "2605514"
          "w"    = 1
          "x"    = 0
          "y"    = 35
          "minH" = 1
          "minW" = 1
        }
      })
    },
    {
      insight_id = 3557021
    },
  ]
}
