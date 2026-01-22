// Constants for Prop Firm Trading Study page

export const STUDY_SUMMARY = {
  currentBalance: 104850,
  totalReturn: 4.85,
  activeDays: 32,
};

export const TIMELINE_DATA = [
  {
    id: "week-4",
    date: "OCT 21 - OCT 27, 2024",
    title: "Week 4: Low Volatility Drift",
    summary: "A quiet week with limited setups as price consolidated near quarterly highs.",
    type: "weekly",
    details: {
      pl: 1100,
      trades: 8,
      metrics: [
        { label: "Win Rate", value: "62.5%" },
        { label: "Avg Risk", value: "1.2%" },
        { label: "Max DD", value: "0.8%" },
      ],
      notes: "Market conditions were challenging with low volatility. Maintained discipline by waiting for high-probability setups. Reduced position sizes to manage risk during consolidation phase.",
    },
  },
  {
    id: "week-3",
    date: "OCT 14 - OCT 20, 2024",
    title: "Week 3: Disciplined Recovery",
    summary: "Strong recovery week following disciplined risk management and selective entry criteria.",
    type: "weekly",
    details: {
      pl: 3400,
      trades: 12,
      metrics: [
        { label: "Win Rate", value: "75%" },
        { label: "Avg Risk", value: "1.5%" },
        { label: "Max DD", value: "1.2%" },
      ],
      notes: "Excellent week with strong performance across multiple setups. Risk management protocols were strictly followed. All trades were within predefined risk parameters.",
    },
  },
  {
    id: "governance-audit",
    date: "OCT 12, 2024",
    title: "Governance Audit: Risk Parameters Confirmed",
    summary: "Third-party verification of risk management framework and trading rules compliance.",
    type: "governance",
    details: null,
  },
  {
    id: "week-2",
    date: "OCT 07 - OCT 13, 2024",
    title: "Week 2: Testing Edge in Drawdown",
    summary: "Challenging week with drawdown testing the strategy's edge and risk management discipline.",
    type: "weekly",
    details: {
      pl: -1800,
      trades: 10,
      metrics: [
        { label: "Win Rate", value: "40%" },
        { label: "Avg Risk", value: "1.8%" },
        { label: "Max DD", value: "2.1%" },
      ],
      notes: "Difficult week with several losing trades. Strategy edge was tested but risk management prevented larger losses. All trades adhered to predefined rules and position sizing guidelines.",
    },
  },
  {
    id: "week-1",
    date: "SEPT 30 - OCT 06, 2024",
    title: "Week 1: Study Initiation",
    summary: "Initial week establishing baseline performance and validating strategy execution framework.",
    type: "weekly",
    details: {
      pl: 2150,
      trades: 9,
      metrics: [
        { label: "Win Rate", value: "66.7%" },
        { label: "Avg Risk", value: "1.3%" },
        { label: "Max DD", value: "0.9%" },
      ],
      notes: "Strong start to the study with consistent execution of the trading rules. All systems functioning as expected. Baseline metrics established for future comparison.",
    },
  },
];
