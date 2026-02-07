# Quick Reference: CI/CD P2P Testing

## Files Added

```
.github/workflows/
  └── test-p2p.yml          # GitHub Actions workflow

CI_CD_IMPLEMENTATION.md     # Implementation summary
CI_CD_TESTING.md            # Architecture diagrams
README.md                   # Updated with CI/CD section
```

## Workflow Triggers

```yaml
Events: pull_request (opened, synchronize, reopened)
Target Branch: main
Permissions: read, write pull-requests, write checks
```

## Test Jobs

### 1. test-self-hosted
- **Infrastructure**: PeerJS (localhost:9000) + Coturn (localhost:3478)
- **Duration**: ~2 minutes
- **Outputs**: JSON results, screenshot, logs

### 2. test-cloud
- **Infrastructure**: PeerJS Cloud + Google STUN
- **Duration**: ~2 minutes  
- **Outputs**: JSON results, screenshot, logs

### 3. report-results
- **Depends on**: Both test jobs
- **Actions**: 
  - Downloads all artifacts
  - Creates PR comment with embedded screenshots
  - Sets GitHub Check status

## PR Comment Format

```
🧪 P2P Test Results

Self-Hosted: ✅ PASSED (8 steps)
Cloud: ✅ PASSED (9 steps)

📸 Screenshots embedded inline
📋 Full JSON in collapsible details
```

## Success Criteria

✅ **PASS**: Both peers complete ≥6 steps each  
❌ **FAIL**: Either peer completes <6 steps

## Artifacts (30-day retention)

```
test-results-local/
  ├── host-result.json
  ├── client-result.json
  └── test-output-local.log

test-results-cloud/
  ├── host-result.json
  ├── client-result.json
  └── test-output-cloud.log

test-screenshot-local.png
test-screenshot-cloud.png
```

## Local Testing

```bash
# Self-hosted test
./run-tests.sh

# Cloud test  
docker compose -f docker-compose.cloud.yml up --abort-on-container-exit

# Results
cat test-results/host-result.json
cat test-results/client-result.json
```

## Viewing Results

### On PR
1. Navigate to PR
2. Find bot comment: "🧪 P2P Test Results"
3. View status, metrics, screenshots
4. Expand "View Full Test Results" for JSON

### In Actions Tab
1. Actions → P2P Tests workflow
2. Click run to see job logs
3. Download artifacts for offline analysis

### Check Status
PR checks show:
- ✅ P2P Tests - Passed
- ❌ P2P Tests - Failed

## Common Commands

```bash
# Re-run tests locally
./run-tests.sh

# View logs
docker compose logs

# Clean up
docker compose down
rm -rf test-results/*.json

# Check workflow syntax
yamllint .github/workflows/test-p2p.yml
```

## Metrics Captured

| Metric | Source | Type |
|--------|--------|------|
| Steps Completed | `steps.length` | Integer |
| Connection Time | Step timestamps | Milliseconds |
| Cards Exchanged | `cardsExchanged` | Boolean |
| Participants | `connectionInfo.participants` | Array |
| Errors | `errors` | Array |
| Network Events | `networkDump` | Array |

## Troubleshooting

### Tests Fail
1. Check PR comment for error details
2. Download artifacts from Actions tab
3. Review `test-output-*.log`
4. Run locally to reproduce
5. Fix and push new commit

### No Screenshot
- Non-blocking issue
- Check workflow logs for Chromium errors
- Tests can still pass without screenshot

### Comment Not Posted
- Check workflow permissions
- Verify `pull-requests: write` permission
- Check GitHub API status

## Required Checks (Optional)

To require tests before merge:

1. Settings → Branches
2. Add rule for `main`
3. Check "Require status checks"
4. Select "P2P Tests"
5. Save

## Performance

| Phase | Time |
|-------|------|
| First run (cold cache) | ~3-4min |
| Subsequent runs (warm cache) | ~1-2min |
| Test execution only | ~10-15s |

## Key Features

✅ Automated testing on every PR  
✅ Visual screenshots in comments  
✅ Both self-hosted and cloud tested  
✅ Artifacts saved for 30 days  
✅ GitHub Check integration  
✅ Zero manual configuration

## Next Steps

After PR merge:
1. Tests run automatically
2. Results posted to PR
3. Review screenshots and metrics
4. Merge if tests pass
5. Artifacts available for 30 days

## Documentation

- Full details: `CI_CD_IMPLEMENTATION.md`
- Architecture: `CI_CD_TESTING.md`
- User guide: `README.md` → CI/CD Testing section

## Support

If issues persist:
1. Check documentation files
2. Review workflow logs in Actions tab
3. Download and analyze artifacts
4. Run tests locally for debugging
5. Check Docker container logs

---

**Quick Start**: Just create a PR! Tests run automatically and results appear as a comment.

