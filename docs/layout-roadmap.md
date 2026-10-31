# `@layout` implementation status

## Implemented: named recursion layouts

AlgoShowMaker now supports persistent layouts for retained recursion snapshots:

```cpp
// @layout recursion as "quick_tree" at canvas.top offset(0,80)
// @layout quick_tree direction top-down
// @frame arr in quick_tree
// @keep last as "partition" in quick_tree
```

The implementation records runtime recursion activation, parent activation, sibling order, and root order. A live `@frame ... in` occupies the current activation node before `@keep` materializes it. The renderer resolves the layout from measured SVG bounds before anchored text, semantic arrows, camera fitting, and thumbnails. Layout edges use the actual rendered outerframe anchors and AV.hpp's black 2px tree-edge style.

Supported settings are `direction`, `mode`/`order`, `align`, `sibling-gap`, `level-gap`, `degree`, `edges`, and `reset`. Every setting line must name its target layout explicitly.
Edges default to black at 2px, matching `AV.hpp`. Top-down layouts connect the parent outerframe bottom anchor to the child outerframe top anchor; the other three directions use their corresponding facing anchors.

Position precedence is:

1. Trace Studio per-frame snapshot placement.
2. An explicit `@keep ... at` binding.
3. The named recursion layout.
4. Automatic keep stacking.

## Deferred: generic object constraints

The following broader syntax remains intentionally deferred until tree, graph, or other draw types establish shared requirements:

- Persistent layouts for arbitrary live objects outside the implemented `@frame ... in` recursion-node binding.
- Independent horizontal and vertical constraints, for example `align-x canvas.center below keep gap 40`.
- Cross-layout collision avoidance and routing between multiple named layouts.
- A generic `@layout object reset` contract for restoring automatic live-object placement.

The virtual `keep` target remains available independently. It represents the union of visible retained snapshot bounds and excludes keep arrows and hidden snapshots.
