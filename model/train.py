"""
Train a logistic regression model on the baby-weights dataset to predict
low birth weight (< 5.5 lbs).

Mirrors the R cleaning/modeling pipeline in:
    Cleaning_Dataset_project.R
    Running model.R

Exports:
    model.json         -> coefficients, feature list, metrics, feature metadata
    feature_schema.json -> UI-friendly schema (label, type, options, default)

Pure numpy + pandas (no sklearn/scipy required). Uses IRLS (Newton-Raphson)
like R's glm(family=binomial).
"""
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).parent
DATA_PATH = HERE.parent / "mnt/Statistical-Analysis-of-Infant-Birth-Weight.-main/baby-weights-dataset.csv"
OUT_DIR = HERE
OUT_DIR.mkdir(exist_ok=True)


# ---------------------------------------------------------------------------
# Data loading & cleaning (mirrors Cleaning_Dataset_project.R)
# ---------------------------------------------------------------------------
def load_and_clean() -> pd.DataFrame:
    df = pd.read_csv(DATA_PATH, na_values=["####", "", "NA"])
    df.columns = [c.lower() for c in df.columns]

    clean = pd.DataFrame(index=df.index)

    # Binary encodings
    clean["baby_male"] = np.where(df["sex"] == 1, 1, np.where(df["sex"] == 2, 0, np.nan))
    clean["mother_married"] = np.where(
        df["marital"] == 1, 1, np.where(df["marital"] == 2, 0, np.nan)
    )

    # Simple numeric passthroughs
    for src, dst in [
        ("fage", "father_age"),
        ("mage", "mother_age"),
        ("feduc", "father_education"),
        ("meduc", "mother_education"),
        ("gained", "weight_gained"),
        ("visits", "visits"),
        ("totalp", "totalp"),
        ("terms", "terms"),
        ("weeks", "weeks"),
        ("cignum", "cignum"),
        ("drinknum", "drinknum"),
    ]:
        clean[dst] = df[src]

    # Child loss: binary "any prior child died"
    clean["child_loss"] = (df["bdead"] > 0).astype(int)

    # Last-outcome dummies (reference = LiveBirth)
    loutcome_group = df["loutcome"].map({1: "LiveBirth", 2: "Stillbirth", 9: "Unknown"})
    clean["loutcome_stillbirth"] = (loutcome_group == "Stillbirth").astype(int)
    clean["loutcome_unknown"] = (loutcome_group == "Unknown").astype(int)

    # Medical conditions (binary)
    medical = [
        "anemia", "cardiac", "aclung", "diabetes", "herpes", "hydram",
        "hemoglob", "hyperch", "hyperpr", "eclamp", "cervix", "pinfant",
        "preterm", "renal", "rhsen", "uterine",
    ]
    for col in medical:
        clean[col] = df[col]

    # Race of mother & father (reference = Other_Asian, matching the R script)
    race_labels = {
        0: "Unknown", 1: "Other_Non_White", 2: "White", 3: "Black",
        4: "American_Indian", 5: "Chinese", 6: "Japanese",
        7: "Hawaiian", 8: "Filipino", 9: "Other_Asian",
    }
    race_non_ref = [v for k, v in race_labels.items() if v != "Other_Asian"]

    mom_race = df["racemom"].map(race_labels)
    dad_race = df["racedad"].map(race_labels)
    for r in race_non_ref:
        clean[f"racemom{r}"] = (mom_race == r).astype(int)
        clean[f"racedad{r}"] = (dad_race == r).astype(int)

    # Hispanic origin (reference = Not_Hispanic)
    hisp_labels = {
        "C": "Cuban", "M": "Mexican", "O": "Colombian", "P": "Peruvian",
        "S": "Salvadoran", "U": "Guatemalan", "N": "Not_Hispanic",
    }
    hisp_non_ref = [v for k, v in hisp_labels.items() if v != "Not_Hispanic"]

    mom_hisp = df["hispmom"].map(hisp_labels)
    dad_hisp = df["hispdad"].map(hisp_labels)
    for h in hisp_non_ref:
        clean[f"hispmom{h}"] = (mom_hisp == h).astype(int)
        clean[f"hispdad{h}"] = (dad_hisp == h).astype(int)

    clean["bweight"] = df["bweight"]
    clean["low_birthweight"] = (df["bweight"] < 5.5).astype(int)

    return clean


def remove_outliers_iqr(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    keep = pd.Series(True, index=df.index)
    for col in cols:
        q1 = df[col].quantile(0.25)
        q3 = df[col].quantile(0.75)
        iqr = q3 - q1
        low, high = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        keep &= df[col].between(low, high)
    return df[keep].copy()


# ---------------------------------------------------------------------------
# Logistic regression via IRLS (same as R's glm(family=binomial))
# ---------------------------------------------------------------------------
def fit_logistic_irls(X: np.ndarray, y: np.ndarray, max_iter: int = 25, tol: float = 1e-6):
    """Fit logistic regression by iteratively reweighted least squares.

    X already includes an intercept column. Returns (beta, std_errors).
    """
    n, p = X.shape
    beta = np.zeros(p)
    for it in range(max_iter):
        eta = X @ beta
        # clip to avoid overflow
        eta = np.clip(eta, -30, 30)
        mu = 1.0 / (1.0 + np.exp(-eta))
        w = mu * (1.0 - mu)
        w = np.maximum(w, 1e-8)
        # Weighted least squares update: beta_new = (X'WX)^-1 X'W z
        # where z = eta + (y - mu) / w
        z = eta + (y - mu) / w
        XtW = X.T * w
        H = XtW @ X                       # p x p
        g = XtW @ z                       # p
        # ridge-ish stabilizer for singular systems (tiny)
        try:
            beta_new = np.linalg.solve(H, g)
        except np.linalg.LinAlgError:
            H_reg = H + 1e-8 * np.eye(p)
            beta_new = np.linalg.solve(H_reg, g)
        if np.max(np.abs(beta_new - beta)) < tol:
            beta = beta_new
            break
        beta = beta_new

    # Compute std errors from the final Fisher information
    eta = np.clip(X @ beta, -30, 30)
    mu = 1.0 / (1.0 + np.exp(-eta))
    w = mu * (1.0 - mu)
    H = (X.T * w) @ X
    try:
        cov = np.linalg.inv(H + 1e-10 * np.eye(p))
        se = np.sqrt(np.clip(np.diag(cov), 0, None))
    except np.linalg.LinAlgError:
        se = np.full(p, np.nan)
    return beta, se


def predict_proba(X: np.ndarray, beta: np.ndarray) -> np.ndarray:
    eta = np.clip(X @ beta, -30, 30)
    return 1.0 / (1.0 + np.exp(-eta))


def auc(y: np.ndarray, p: np.ndarray) -> float:
    # Mann-Whitney U based AUC
    order = np.argsort(p)
    y_sorted = y[order]
    ranks = np.arange(1, len(y) + 1)
    pos_ranks_sum = ranks[y_sorted == 1].sum()
    n_pos = y_sorted.sum()
    n_neg = len(y) - n_pos
    if n_pos == 0 or n_neg == 0:
        return float("nan")
    return (pos_ranks_sum - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg)


# ---------------------------------------------------------------------------
# Feature metadata for the UI
# ---------------------------------------------------------------------------
FEATURE_SCHEMA = [
    # section: Pregnancy basics
    {"key": "mother_age", "label": "Mother's age (years)", "type": "number", "min": 12, "max": 55, "default": 28, "section": "Pregnancy basics"},
    {"key": "father_age", "label": "Father's age (years)", "type": "number", "min": 14, "max": 70, "default": 30, "section": "Pregnancy basics"},
    {"key": "weeks", "label": "Weeks of gestation", "type": "number", "min": 20, "max": 45, "default": 39, "section": "Pregnancy basics"},
    {"key": "weight_gained", "label": "Weight gained during pregnancy (lbs)", "type": "number", "min": 0, "max": 80, "default": 30, "section": "Pregnancy basics"},
    {"key": "visits", "label": "Prenatal visits", "type": "number", "min": 0, "max": 30, "default": 11, "section": "Pregnancy basics"},
    {"key": "totalp", "label": "Total pregnancies (including this one)", "type": "number", "min": 1, "max": 15, "default": 2, "section": "Pregnancy basics"},
    {"key": "terms", "label": "Prior terminations", "type": "number", "min": 0, "max": 10, "default": 0, "section": "Pregnancy basics"},
    {"key": "child_loss", "label": "Prior child loss", "type": "boolean", "default": 0, "section": "Pregnancy basics"},

    # section: Demographics
    {"key": "baby_male", "label": "Baby's sex", "type": "select", "options": [{"value": 1, "label": "Male"}, {"value": 0, "label": "Female"}], "default": 1, "section": "Demographics"},
    {"key": "mother_married", "label": "Mother married", "type": "boolean", "default": 1, "section": "Demographics"},
    {"key": "mother_education", "label": "Mother's years of education", "type": "number", "min": 0, "max": 20, "default": 14, "section": "Demographics"},
    {"key": "father_education", "label": "Father's years of education", "type": "number", "min": 0, "max": 20, "default": 14, "section": "Demographics"},
    {
        "key": "racemom",
        "label": "Mother's race",
        "type": "race",
        "default": "White",
        "section": "Demographics",
        "options": [
            {"value": "Other_Asian", "label": "Other Asian (reference)"},
            {"value": "White", "label": "White"},
            {"value": "Black", "label": "Black"},
            {"value": "American_Indian", "label": "American Indian"},
            {"value": "Chinese", "label": "Chinese"},
            {"value": "Japanese", "label": "Japanese"},
            {"value": "Hawaiian", "label": "Hawaiian"},
            {"value": "Filipino", "label": "Filipino"},
            {"value": "Other_Non_White", "label": "Other Non-White"},
            {"value": "Unknown", "label": "Unknown"},
        ],
    },
    {
        "key": "racedad",
        "label": "Father's race",
        "type": "race",
        "default": "White",
        "section": "Demographics",
        "options": [
            {"value": "Other_Asian", "label": "Other Asian (reference)"},
            {"value": "White", "label": "White"},
            {"value": "Black", "label": "Black"},
            {"value": "American_Indian", "label": "American Indian"},
            {"value": "Chinese", "label": "Chinese"},
            {"value": "Japanese", "label": "Japanese"},
            {"value": "Hawaiian", "label": "Hawaiian"},
            {"value": "Filipino", "label": "Filipino"},
            {"value": "Other_Non_White", "label": "Other Non-White"},
            {"value": "Unknown", "label": "Unknown"},
        ],
    },
    {
        "key": "hispmom",
        "label": "Mother Hispanic origin",
        "type": "hispanic",
        "default": "Not_Hispanic",
        "section": "Demographics",
        "options": [
            {"value": "Not_Hispanic", "label": "Not Hispanic (reference)"},
            {"value": "Cuban", "label": "Cuban"},
            {"value": "Mexican", "label": "Mexican"},
            {"value": "Colombian", "label": "Colombian"},
            {"value": "Peruvian", "label": "Peruvian"},
            {"value": "Salvadoran", "label": "Salvadoran"},
            {"value": "Guatemalan", "label": "Guatemalan"},
        ],
    },
    {
        "key": "hispdad",
        "label": "Father Hispanic origin",
        "type": "hispanic",
        "default": "Not_Hispanic",
        "section": "Demographics",
        "options": [
            {"value": "Not_Hispanic", "label": "Not Hispanic (reference)"},
            {"value": "Cuban", "label": "Cuban"},
            {"value": "Mexican", "label": "Mexican"},
            {"value": "Colombian", "label": "Colombian"},
            {"value": "Peruvian", "label": "Peruvian"},
            {"value": "Salvadoran", "label": "Salvadoran"},
            {"value": "Guatemalan", "label": "Guatemalan"},
        ],
    },

    # section: Lifestyle
    {"key": "cignum", "label": "Average cigarettes per day", "type": "number", "min": 0, "max": 80, "default": 0, "section": "Lifestyle"},
    {"key": "drinknum", "label": "Average alcoholic drinks per day", "type": "number", "min": 0, "max": 20, "default": 0, "section": "Lifestyle"},

    # section: Prior pregnancy outcomes
    {"key": "loutcome_stillbirth", "label": "Last pregnancy was stillbirth", "type": "boolean", "default": 0, "section": "Prior outcomes"},
    {"key": "loutcome_unknown", "label": "Last pregnancy outcome unknown", "type": "boolean", "default": 0, "section": "Prior outcomes"},

    # section: Medical conditions
    {"key": "anemia", "label": "Anemia", "type": "boolean", "default": 0, "section": "Medical conditions"},
    {"key": "cardiac", "label": "Cardiac disease", "type": "boolean", "default": 0, "section": "Medical conditions"},
    {"key": "aclung", "label": "Acute/chronic lung disease", "type": "boolean", "default": 0, "section": "Medical conditions"},
    {"key": "diabetes", "label": "Diabetes", "type": "boolean", "default": 0, "section": "Medical conditions"},
    {"key": "herpes", "label": "Genital herpes", "type": "boolean", "default": 0, "section": "Medical conditions"},
    {"key": "hydram", "label": "Hydramnios/oligohydramnios", "type": "boolean", "default": 0, "section": "Medical conditions"},
    {"key": "hemoglob", "label": "Hemoglobinopathy", "type": "boolean", "default": 0, "section": "Medical conditions"},
    {"key": "hyperch", "label": "Chronic hypertension", "type": "boolean", "default": 0, "section": "Medical conditions"},
    {"key": "hyperpr", "label": "Pregnancy-induced hypertension", "type": "boolean", "default": 0, "section": "Medical conditions"},
    {"key": "eclamp", "label": "Eclampsia", "type": "boolean", "default": 0, "section": "Medical conditions"},
    {"key": "cervix", "label": "Incompetent cervix", "type": "boolean", "default": 0, "section": "Medical conditions"},
    {"key": "pinfant", "label": "Previous infant 4000g+", "type": "boolean", "default": 0, "section": "Medical conditions"},
    {"key": "preterm", "label": "Previous preterm/small infant", "type": "boolean", "default": 0, "section": "Medical conditions"},
    {"key": "renal", "label": "Renal disease", "type": "boolean", "default": 0, "section": "Medical conditions"},
    {"key": "rhsen", "label": "Rh sensitization", "type": "boolean", "default": 0, "section": "Medical conditions"},
    {"key": "uterine", "label": "Uterine bleeding", "type": "boolean", "default": 0, "section": "Medical conditions"},
]


PRETTY_NAMES = {
    "(Intercept)": "Intercept",
    "baby_male": "Baby is Male",
    "mother_married": "Mother is Married",
    "father_age": "Father's Age",
    "mother_age": "Mother's Age",
    "father_education": "Father's Education",
    "mother_education": "Mother's Education",
    "weight_gained": "Weight Gained During Pregnancy",
    "visits": "Prenatal Visits",
    "totalp": "Total Pregnancies",
    "terms": "Prior Terminations",
    "weeks": "Gestation Weeks",
    "cignum": "Avg. Cigarettes per Day",
    "drinknum": "Avg. Drinks per Day",
    "child_loss": "Prior Child Loss",
    "loutcome_stillbirth": "Last Pregnancy Stillbirth",
    "loutcome_unknown": "Unknown Last Pregnancy Outcome",
    "anemia": "Anemia",
    "cardiac": "Cardiac Disease",
    "aclung": "Acute Lung Disease",
    "diabetes": "Diabetes",
    "herpes": "Genital Herpes",
    "hydram": "Hydramnios",
    "hemoglob": "Low Hemoglobin",
    "hyperch": "Chronic Hypertension",
    "hyperpr": "Pregnancy-Induced Hypertension",
    "eclamp": "Eclampsia",
    "cervix": "Cervical Incompetence",
    "pinfant": "Previous Infant 4000g+",
    "preterm": "Preterm History",
    "renal": "Renal Disease",
    "rhsen": "Rh Sensitization",
    "uterine": "Uterine Bleeding",
}


def pretty(name: str) -> str:
    if name in PRETTY_NAMES:
        return PRETTY_NAMES[name]
    if name.startswith("racemom"):
        return f"Mother's Race: {name.replace('racemom', '').replace('_', ' ')}"
    if name.startswith("racedad"):
        return f"Father's Race: {name.replace('racedad', '').replace('_', ' ')}"
    if name.startswith("hispmom"):
        return f"Mother Hispanic: {name.replace('hispmom', '')}"
    if name.startswith("hispdad"):
        return f"Father Hispanic: {name.replace('hispdad', '')}"
    return name


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("Loading & cleaning data...")
    clean = load_and_clean()
    print(f"  rows after cleaning columns: {len(clean)}")

    # Outlier removal (matches R script)
    clean = remove_outliers_iqr(clean, ["father_age", "mother_age", "totalp", "bweight"])
    print(f"  rows after IQR outlier removal: {len(clean)}")

    # Drop rows with NA in any model column
    feature_cols = [c for c in clean.columns if c not in ("bweight", "low_birthweight")]
    modeled = clean[feature_cols + ["low_birthweight"]].dropna().copy()
    print(f"  rows after dropping NA: {len(modeled)}")

    y = modeled["low_birthweight"].to_numpy(dtype=float)
    X_df = modeled[feature_cols].astype(float)

    # Build design matrix with intercept
    X = np.hstack([np.ones((len(X_df), 1)), X_df.to_numpy()])
    names = ["(Intercept)"] + feature_cols

    print("Fitting logistic regression (IRLS)...")
    beta, se = fit_logistic_irls(X, y, max_iter=30)
    print(f"  converged; |beta| range: [{np.nanmin(np.abs(beta)):.4f}, {np.nanmax(np.abs(beta)):.4f}]")

    # Evaluation
    probs = predict_proba(X, beta)
    preds = (probs >= 0.5).astype(int)
    accuracy = float((preds == y).mean())
    base_rate = float(y.mean())
    model_auc = float(auc(y, probs))
    tp = int(((preds == 1) & (y == 1)).sum())
    tn = int(((preds == 0) & (y == 0)).sum())
    fp = int(((preds == 1) & (y == 0)).sum())
    fn = int(((preds == 0) & (y == 1)).sum())
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0

    print(f"  accuracy: {accuracy:.4f}  base rate: {base_rate:.4f}  AUC: {model_auc:.4f}")
    print(f"  precision: {precision:.4f}  recall: {recall:.4f}  F1: {f1:.4f}")

    # Wald p-values
    z = beta / np.where(se > 0, se, np.nan)
    # two-sided p-value from normal approximation
    # using erf: p = 2 * (1 - Phi(|z|))
    from math import erf, sqrt
    def pval(zi):
        if math.isnan(zi):
            return float("nan")
        return 2 * (1 - 0.5 * (1 + erf(abs(zi) / sqrt(2))))
    p_values = np.array([pval(zi) for zi in z])

    def safe_exp(x):
        try:
            return math.exp(max(min(x, 50), -50))
        except OverflowError:
            return float("inf") if x > 0 else 0.0

    # Per-feature metadata (used both at predict-time & for the findings page)
    coefs = []
    for i, name in enumerate(names):
        b = float(beta[i])
        s = float(se[i]) if not math.isnan(se[i]) else None
        p = float(p_values[i]) if not math.isnan(p_values[i]) else None
        odds_ratio = safe_exp(b)
        coefs.append({
            "name": name,
            "pretty_name": pretty(name),
            "coef": b,
            "std_error": s,
            "p_value": p,
            "odds_ratio": odds_ratio,
            "ci_lower": safe_exp(b - 1.96 * (s or 0.0)) if s else None,
            "ci_upper": safe_exp(b + 1.96 * (s or 0.0)) if s else None,
        })

    # Top-N significant predictors by |logOR| and p<0.05
    significant = sorted(
        [c for c in coefs if c["name"] != "(Intercept)" and (c["p_value"] or 1) < 0.05],
        key=lambda c: abs(c["coef"]),
        reverse=True,
    )
    top_10 = significant[:10]

    model_json = {
        "intercept": float(beta[0]),
        "features": [
            {
                "name": names[i],
                "coef": float(beta[i]),
                "std_error": float(se[i]) if not math.isnan(se[i]) else None,
                "p_value": float(p_values[i]) if not math.isnan(p_values[i]) else None,
            }
            for i in range(1, len(names))
        ],
        "metrics": {
            "accuracy": accuracy,
            "base_rate": base_rate,
            "auc": model_auc,
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "confusion_matrix": {"tp": tp, "tn": tn, "fp": fp, "fn": fn},
            "n_rows": int(len(modeled)),
            "n_features": len(names) - 1,
        },
        "coefficients_table": coefs,
        "top_predictors": top_10,
    }

    with (OUT_DIR / "model.json").open("w") as f:
        json.dump(model_json, f, indent=2)
    print(f"Wrote {OUT_DIR / 'model.json'}")

    # UI-friendly schema
    with (OUT_DIR / "feature_schema.json").open("w") as f:
        json.dump(FEATURE_SCHEMA, f, indent=2)
    print(f"Wrote {OUT_DIR / 'feature_schema.json'}")

    # Print top predictors for eyeballing
    print("\nTop 10 significant predictors (by |logOR|):")
    for c in top_10:
        print(f"  {c['pretty_name']:<40} OR={c['odds_ratio']:.3f}  p={c['p_value']:.2e}")


if __name__ == "__main__":
    main()
