# Birth Weight Risk · Predictive Analytics Final Project

An interactive web app that predicts the probability of low birth weight (< 5.5 lb) from maternal,
paternal, and pregnancy-level inputs. Originally a Group 8 R analysis of ~101,000 US natality
records, this project reproduces the analysis in Python and wraps it in a Next.js + Vercel
deployable web app.

- **Model**: Binomial logistic regression, 46 features, trained via IRLS (same algorithm as R's
  `glm(family=binomial)`), with a small L2 penalty for stability.
- **Metrics**: ROC-AUC 0.85 · Accuracy 95.5% · n = 95,117 pregnancies after cleaning.
- **Inference**: Client-side for instant feedback while editing; Vercel Python serverless function
  for the authoritative prediction.

## Tech stack

| Layer        | Choice                                    |
|--------------|-------------------------------------------|
| Frontend     | Next.js 14 (App Router) · TypeScript      |
| Styling      | Tailwind CSS · shadcn-style primitives    |
| Charts       | Recharts                                  |
| ML training  | Python · numpy · pandas (no sklearn)      |
| Inference    | Python 3 stdlib on Vercel serverless      |
| Hosting      | Vercel                                    |

## Project structure

```
.
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Landing
│   ├── predict/                  # Interactive predictor
│   ├── findings/                 # Odds-ratio charts + coefficient table
│   ├── methodology/              # Writeup & limitations
│   ├── layout.tsx
│   └── globals.css
├── api/
│   ├── predict.py                # Vercel Python serverless function
│   └── requirements.txt          # (empty — stdlib only)
├── components/                   # Nav + shadcn-style UI components
├── lib/
│   ├── model.ts                  # Shared logistic-regression inference (TS)
│   ├── schema.ts                 # Form field types
│   └── utils.ts
├── public/
│   ├── model.json                # Trained coefficients + metrics
│   ├── feature_schema.json       # UI-friendly schema
│   ├── Project Proposal_Group8.docx
│   └── Group_8_Predictive_PPT.pdf
├── model/
│   ├── train.py                  # Training pipeline (pure numpy + pandas)
│   └── model.json
├── baby-weights-dataset.csv      # Raw data (101,400 rows)
├── Cleaning_Dataset_project.R    # Original R cleaning script (preserved)
├── Running model.R               # Original R modeling script (preserved)
├── package.json
├── vercel.json
└── next.config.mjs
```

## Local development

```bash
# 1. Install Node deps
npm install

# 2. (Optional) retrain the model from source
pip install pandas numpy
python3 model/train.py           # writes model/model.json
cp model/model.json public/      # expose to the app

# 3. Run the dev server
npm run dev                      # http://localhost:3000
```

The Python serverless function (`api/predict.py`) runs automatically during
`vercel dev` (install the Vercel CLI) or after deployment.

## Deploy to Vercel

### Option A: GitHub → Vercel (recommended)

1. Push this repo to GitHub.
2. Open [vercel.com/new](https://vercel.com/new), import the repo.
3. Vercel auto-detects Next.js and the Python function. Hit **Deploy**.

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel           # first deploy — creates the project
vercel --prod    # production deploy
```

## How the model was built

1. **Load & clean** — mirrors the original R cleaning script.
   - Re-encode `sex`, `marital` as binary indicators.
   - Collapse `bdead` to a single `child_loss` flag.
   - One-hot encode race (reference: Other_Asian) and Hispanic origin (reference: Not_Hispanic)
     and last-pregnancy outcome (reference: LiveBirth).
2. **Outlier removal** — IQR rule on `father_age`, `mother_age`, `totalp`, `bweight`.
3. **Fit** — IRLS (Newton–Raphson) with a small ridge penalty (λ = 1.0) on non-intercept
   coefficients. Converges in under 10 iterations.
4. **Export** — coefficients, standard errors, p-values, odds ratios, and model metrics are
   written to `model/model.json` and copied to `public/` for the app to consume.

The exact steps live in [`model/train.py`](model/train.py) — one file, ~300 lines.

## Top predictors

Top 10 statistically significant predictors (p < 0.05) by |log odds ratio|:

| Feature                     | Odds ratio | Direction       |
|-----------------------------|-----------:|-----------------|
| Father Hispanic: Guatemalan |       3.17 | Risk            |
| Eclampsia                   |       3.12 | Risk            |
| Previous Infant 4000g+      |       0.34 | Protective      |
| Mother Hispanic: Cuban      |       2.26 | Risk            |
| Preterm History             |       2.15 | Risk            |
| Uterine Bleeding            |       2.14 | Risk            |
| Renal Disease               |       2.05 | Risk            |
| Cervical Incompetence       |       2.05 | Risk            |
| Chronic Hypertension        |       1.67 | Risk            |
| Unknown Last Outcome        |       1.45 | Risk            |

These align with published clinical risk factors for low birth weight.

## Limitations

- Evaluated on the training set (matches the R report; goal is inferential).
- Rare categorical levels have wide confidence intervals.
- Correlation, not causation.
- **Not medical advice.** Research artifact only.

## Credit

Based on a final project for Spring 2025 Predictive Analytics (Group 8). The R pipeline and the
original analysis live in `Cleaning_Dataset_project.R` and `Running model.R` and are preserved for
reference.
