# Snapshot before the paired cross-reader refresh

These files preserve the evidence merged in PR #12 at commit
`cedb212`, using comparison reader `45bbec34`. That run used a shared host.
The newer snapshot uses a separate workflow runner and retains each timing
round. Differences between these hosts cannot isolate a reader speed change.
