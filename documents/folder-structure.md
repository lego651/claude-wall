# 📁 Folder Structure

```
root
│
├── data
│   └── firms
│       └── {firmId}
│           ├── rules.json
│           ├── payouts.json
│           ├── discounts.json
│           └── history
│               └── {timestamp}.json
│
├── news
│   └── YYYY-MM-DD-firm-update.md
│
├── src
│   ├── app
│   ├── components
│   ├── lib
│   └── hooks
│
├── scripts
│   ├── cron-scan.js
│   ├── diff-rules.js
│   └── generate-summary.js
│
├── public
│
└── README.md
```
