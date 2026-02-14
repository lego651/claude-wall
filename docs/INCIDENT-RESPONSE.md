# Incident response (PROP-024)

## Flowchart

```
┌─────────────────────────────────────────────────────────────────┐
│ Alert received (email / log / dashboard)                         │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Triage: Identify service (Arbiscan, Supabase, Sync, File, etc.) │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Open docs/RUNBOOKS.md → follow section for that service           │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
                    ┌───────────┴───────────┐
                    ▼                       ▼
            ┌───────────────┐       ┌───────────────┐
            │ Can fix in    │       │ Need help or  │
            │ < 30 min      │       │ > 30 min      │
            └───────┬───────┘       └───────┬───────┘
                    │                       │
                    ▼                       ▼
            ┌───────────────┐       ┌───────────────┐
            │ Apply runbook │       │ Escalate      │
            │ steps; verify │       │ (see below)   │
            └───────┬───────┘       └───────────────┘
                    │
                    ▼
            ┌───────────────┐
            │ Resolved?     │──No──► Escalate
            └───────┬───────┘
                    │ Yes
                    ▼
            ┌───────────────┐
            │ Log summary;  │
            │ close incident│
            └───────────────┘
```

## Escalation paths

| Severity   | Owner        | Next escalation   | When to escalate                    |
|-----------|---------------|-------------------|-------------------------------------|
| **INFO**  | On-call / dev | —                 | No escalation; log only             |
| **WARNING** | On-call / dev | Senior / ops    | Not resolved in 30 min or recurring |
| **CRITICAL** | On-call / dev | Senior → P0     | Service down; not resolved in 15 min |

- **On-call:** Person responsible for alerts (receives `ALERT_EMAIL`).
- **Senior / ops:** [Add contact – e.g. Slack channel, email, or PagerDuty].
- **P0:** [Add contact for production-down – e.g. tech lead, CTO].

## Contact information

*(Fill in for your team.)*

| Role / channel   | Purpose              | Contact |
|------------------|----------------------|---------|
| Alert recipient  | Receives all alerts  | `ALERT_EMAIL` (env) |
| On-call          | First response       | _e.g. team@example.com_ |
| Escalation       | WARNING/CRITICAL     | _e.g. #incidents Slack_ |
| Supabase support | DB/API issues        | [Supabase dashboard](https://supabase.com/dashboard) / support |
| Arbiscan         | API/rate limit       | [Arbiscan](https://arbiscan.io/) |

## Post-incident

1. **Resolve** using the runbook; confirm service and alerts are back to normal.
2. **Log** a short summary (what happened, root cause, fix, and any follow-up).
3. **Review with team** if severity was WARNING or CRITICAL; update runbooks or alerts if needed.
