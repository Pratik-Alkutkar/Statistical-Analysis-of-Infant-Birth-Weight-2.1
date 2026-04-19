import Link from "next/link";
import { ArrowRight, FileText, Github } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import modelData from "@/public/model.json";
import type { ModelJSON } from "@/lib/model";

export const metadata = {
  title: "Methodology · Birth Weight Risk",
  description: "How the dataset was cleaned, how the model was fit, and the limitations of the approach.",
};

export default function MethodologyPage() {
  const model = modelData as ModelJSON;
  return (
    <div className="container py-10 md:py-14">
      <div className="mx-auto max-w-3xl space-y-10">
        <div>
          <Badge variant="outline" className="mb-4">Final Project · Predictive Analytics</Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Methodology</h1>
          <p className="mt-3 text-muted-foreground">
            The project goal was to understand which maternal, paternal, and lifestyle factors most strongly
            predict low birth weight (&lt; 5.5 lb). The work started as an R analysis; this site reproduces
            that analysis in Python and wraps it in an interactive app so the model can be explored.
          </p>
        </div>

        <Section title="1 · Dataset" subtitle="101,400 US natality records, 37 variables">
          <p>
            Each record represents a pregnancy and includes maternal and paternal demographics (age,
            education, race, Hispanic origin, marital status), pregnancy history (total pregnancies,
            prior terminations, last-delivery outcome), prenatal care (number of visits, weight
            gained), lifestyle (average cigarettes per day, average drinks per day), and sixteen
            binary maternal medical conditions ranging from anemia to uterine bleeding. The outcome is
            birth weight in pounds, which we threshold at 5.5 lb to produce a binary{" "}
            <code>low_birthweight</code> target.
          </p>
        </Section>

        <Section title="2 · Cleaning" subtitle="From 101,400 rows to 95,117 rows">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Lowercased column names for consistency with the R code.
            </li>
            <li>
              Re-encoded <code>sex</code> and <code>marital</code> as binary indicators
              (<code>baby_male</code>, <code>mother_married</code>).
            </li>
            <li>
              Collapsed <code>bdead</code> (number of prior children who died) into a single{" "}
              <code>child_loss</code> indicator.
            </li>
            <li>
              One-hot encoded <code>loutcome</code> (last pregnancy outcome) with &ldquo;LiveBirth&rdquo;
              as the reference level.
            </li>
            <li>
              One-hot encoded mother and father race with &ldquo;Other_Asian&rdquo; as the reference
              level, and Hispanic origin with &ldquo;Not_Hispanic&rdquo; as the reference.
            </li>
            <li>
              Removed outliers on <code>father_age</code>, <code>mother_age</code>,{" "}
              <code>totalp</code>, and <code>bweight</code> using the 1.5 × IQR rule. This is the same
              subset used in the R report (&ldquo;second&rdquo; outlier-removed dataset).
            </li>
            <li>
              Dropped rows with missing values in any model column.
            </li>
          </ul>
        </Section>

        <Section title="3 · Model" subtitle="Binomial logistic regression, fit via IRLS">
          <p>
            We fit a binomial logistic regression with{" "}
            <strong>{model.metrics.n_features}</strong> predictors using iteratively-reweighted least
            squares — the same algorithm R&rsquo;s <code>glm(family=binomial)</code> uses — with a small
            L2 penalty (&lambda; = 1.0, not applied to the intercept) to stabilize estimation when
            categorical dummies are near-separating. IRLS converges in under 10 iterations on ~95k
            rows.
          </p>
          <p>
            Training runs in pure Python + numpy (no scikit-learn required), which means the whole
            pipeline — from raw CSV to exported <code>model.json</code> — is a single, inspectable
            script. Inference at the edge is equally light: the Vercel serverless function loads the
            coefficients and computes one dot product.
          </p>
        </Section>

        <Section title="4 · Evaluation" subtitle="AUC 0.85 · Accuracy 95.5%">
          <p>
            We evaluate on the training data (this matches the R report, and the goal is inferential
            rather than out-of-sample prediction). AUC of{" "}
            <strong>{model.metrics.auc.toFixed(3)}</strong> indicates the model ranks pregnancies well
            by true LBW risk. Accuracy is high at{" "}
            <strong>{(model.metrics.accuracy * 100).toFixed(1)}%</strong>, but low-birth-weight is a
            rare outcome (base rate ≈{" "}
            <strong>{(model.metrics.base_rate * 100).toFixed(1)}%</strong>), so recall at the default
            0.5 threshold is modest. For a clinical tool a lower threshold would trade precision for
            recall.
          </p>
        </Section>

        <Section title="5 · Limitations" subtitle="Read before over-interpreting any single number">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Causation vs. correlation.</strong> Logistic regression describes associations;
              it cannot tell us whether &ldquo;mother&rsquo;s education&rdquo; causes lower LBW risk
              or whether both are downstream of socio-economic status.
            </li>
            <li>
              <strong>Training-set evaluation.</strong> Metrics are optimistic. A train/test split or
              cross-validation would give a more honest generalization estimate.
            </li>
            <li>
              <strong>Rare categories are unstable.</strong> Some race / Hispanic origin levels have
              few positive cases and wide confidence intervals.
            </li>
            <li>
              <strong>Not medical advice.</strong> This is a research project by a graduate class, not
              a clinical decision tool.
            </li>
          </ul>
        </Section>

        <Section title="6 · Architecture" subtitle="Next.js + Python serverless on Vercel">
          <p>
            The frontend is Next.js 14 (App Router) with Tailwind and a small set of shadcn-style
            components. Charts use Recharts. Predictions happen two ways: a live client-side pass
            while the user edits the form (instant feedback, no network), and a more complete server
            pass from a Vercel Python serverless function when the user clicks &ldquo;Run full
            prediction.&rdquo; Both code paths share the same exported{" "}
            <code>model.json</code>, so results are identical.
          </p>
        </Section>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Project proposal</CardTitle>
                <CardDescription>Original Word doc (Group 8)</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <a
                href="/Project Proposal_Group8.docx"
                className="text-sm font-medium text-primary hover:underline"
              >
                Download proposal →
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Presentation deck</CardTitle>
                <CardDescription>Group 8 predictive analysis slides</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <a
                href="/Group_8_Predictive_PPT.pdf"
                className="text-sm font-medium text-primary hover:underline"
              >
                View slides →
              </a>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col items-start gap-3 rounded-lg border bg-muted/30 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Try the live predictor</p>
            <p className="text-sm text-muted-foreground">
              Adjust pregnancy details and see the probability update live.
            </p>
          </div>
          <Link href="/predict">
            <Button>
              Go to predictor
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
