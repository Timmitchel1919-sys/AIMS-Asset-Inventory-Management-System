# AIMS device preview architecture

`DeviceFrame` provides a reusable masked screen with device type, screen ratio, screen radius, inset, bezel width, orientation, object position, and accessible label. The inner screen uses `overflow: hidden`, its own radius, and paint containment.

| Device | Screen ratio | Layout source | Inset | Screen radius |
|---|---:|---|---:|---:|
| Desktop | 16:9 | `DashboardPreviewDesktop` | 10px | 10px |
| Laptop | 16:10 | condensed desktop preview | 8px | 8px |
| Tablet | 4:3 | `DashboardPreviewTablet` | 9px | 12px |
| Mobile | 9:19.5 | `DashboardPreviewMobile` | 7px | 22px |

The previews are lightweight visual components based on the real app’s sidebar, KPI, chart, activity, table, and responsive-navigation patterns. They use consistent synthetic metrics. On narrow phones, desktop and laptop frames are removed; mobile is primary and tablet becomes secondary.
