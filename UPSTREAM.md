# Upstream (Hermes Agent)

This repository is a public fork of
[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)
for the **Houdry Agent** product (desktop + runtime), used with the
[Houdry GPU fabric](https://github.com/houdry-genomex/houdry).

## Pinned upstream commit

At fork time this tree matched:

```text
cced6fa360a589ba50abfde687ef1bcba8ddaf2e
```

(`refactor(cron): extract _get_session_db_timeout alongside sibling timeout resolvers`)

## Remotes

```bash
git remote -v
# origin    https://github.com/houdry-genomex/houdry-agent.git
# upstream  https://github.com/NousResearch/hermes-agent.git
```

## Syncing from Hermes

```bash
git fetch upstream
git log --oneline HEAD..upstream/main | head
# Prefer rebase or selective cherry-picks for large Hermes updates:
git cherry-pick <commit>
# or
git merge upstream/main
```

Keep Houdry-specific branding (`NOTICE`, Desktop `productName`, default
`~/.houdry-agent`, Houdry `/v1` provider defaults) when resolving conflicts.

## Credit

See [NOTICE](NOTICE) and [LICENSE](LICENSE). Always retain Nous Research’s
MIT copyright notice.
