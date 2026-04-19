/**
 * Shared logistic-regression utilities.
 *
 * Loads the exported model (trained in Python via model/train.py) and runs
 * predictions. Designed to work identically in Node (API route) and in the
 * browser, so the app has a fast client-side fallback even without the
 * serverless function.
 */

export interface FeatureCoef {
  name: string;
  coef: number;
  std_error: number | null;
  p_value: number | null;
}

export interface CoefEntry {
  name: string;
  pretty_name: string;
  coef: number;
  std_error: number | null;
  p_value: number | null;
  odds_ratio: number;
  ci_lower: number | null;
  ci_upper: number | null;
}

export interface ModelJSON {
  intercept: number;
  features: FeatureCoef[];
  metrics: {
    accuracy: number;
    base_rate: number;
    auc: number;
    precision: number;
    recall: number;
    f1: number;
    confusion_matrix: { tp: number; tn: number; fp: number; fn: number };
    n_rows: number;
    n_features: number;
  };
  coefficients_table: CoefEntry[];
  top_predictors: CoefEntry[];
}

export type UserInput = Record<string, number | string>;

const RACE_LEVELS = [
  "Unknown",
  "Other_Non_White",
  "White",
  "Black",
  "American_Indian",
  "Chinese",
  "Japanese",
  "Hawaiian",
  "Filipino",
];
const HISP_LEVELS = ["Cuban", "Mexican", "Colombian", "Peruvian", "Salvadoran", "Guatemalan"];

/**
 * Convert UI-friendly inputs (e.g., racemom: "White") into the exact feature
 * vector the model expects (racemomWhite: 1, racemomBlack: 0, ...).
 */
export function expandInput(ui: UserInput): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(ui)) {
    if (k === "racemom" || k === "racedad") {
      for (const lvl of RACE_LEVELS) {
        out[`${k}${lvl}`] = v === lvl ? 1 : 0;
      }
      continue;
    }
    if (k === "hispmom" || k === "hispdad") {
      for (const lvl of HISP_LEVELS) {
        out[`${k}${lvl}`] = v === lvl ? 1 : 0;
      }
      continue;
    }
    out[k] = typeof v === "number" ? v : Number(v);
  }
  return out;
}

function sigmoid(z: number): number {
  if (z >= 30) return 1 - 1e-14;
  if (z <= -30) return 1e-14;
  return 1 / (1 + Math.exp(-z));
}

export interface PredictionResult {
  probability: number;
  logit: number;
  topContributors: Array<{
    name: string;
    pretty_name: string;
    contribution: number; // signed log-odds contribution for the given input
    odds_ratio: number;
    value: number;
  }>;
  risk: "low" | "moderate" | "high";
}

/**
 * Compute probability of low birth weight and return the top contributors
 * (by absolute log-odds contribution) so we can explain the prediction.
 */
export function predict(model: ModelJSON, ui: UserInput): PredictionResult {
  const x = expandInput(ui);
  let logit = model.intercept;
  const contribs: Array<{ name: string; pretty_name: string; contribution: number; odds_ratio: number; value: number }> = [];
  const prettyByName = Object.fromEntries(model.coefficients_table.map((c) => [c.name, c.pretty_name]));

  for (const feat of model.features) {
    const val = x[feat.name] ?? 0;
    const contrib = val * feat.coef;
    logit += contrib;
    if (val !== 0) {
      contribs.push({
        name: feat.name,
        pretty_name: prettyByName[feat.name] ?? feat.name,
        contribution: contrib,
        odds_ratio: Math.exp(feat.coef),
        value: val,
      });
    }
  }

  const probability = sigmoid(logit);
  const topContributors = contribs
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 6);

  let risk: "low" | "moderate" | "high" = "low";
  if (probability >= 0.25) risk = "high";
  else if (probability >= 0.1) risk = "moderate";

  return { probability, logit, topContributors, risk };
}
