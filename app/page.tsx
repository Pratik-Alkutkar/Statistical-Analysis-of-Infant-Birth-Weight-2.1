import Link from "next/link";
import { Activity, ArrowRight, BarChart3, Database, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import modelData from "@/public/model.json";
import type { ModelJSON } from "@/lib/model";

const model = modelData as ModelJSON;

export default function Home() {
  const { metrics, top_predictors } = model;
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background" />
        <div className="container relative py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-6">
              <Sparkles className="mr-1 h-3 w-3" />
              Final project · Predictive Analytics
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
              What drives <span className="text-primary">low birth weight</span>?
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              A logistic-regression model trained on{" "}
              <span className="font-semibold text-foreground">{metrics.n_rows.toLocaleString()}</span>{" "}
              pregnancies. Enter pregnancy details and see which factors move the risk — and by how much.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/predict">
                <Button size="lg">
                  Try the predictor
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/findings">
                <Button size="lg" variant="outline">
                  See the findings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Key metrics */}
      <section className="container py-16">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-4">
          <Stat icon={<Database className="h-4 w-4" />} label="Training rows" value={metrics.n_rows.toLocaleString()} />
          <Stat icon={<BarChart3 className="h-4 w-4" />} label="Features" value={String(metrics.n_features)} />
          <Stat icon={<Activity className="h-4 w-4" />} label="ROC-AUC" value={metrics.auc.toFixed(3)} />
          <Stat icon={<Sparkles className="h-4 w-4" />} label="Accuracy" value={`${(metrics.accuracy * 100).toFixed(1)}%`} />
        </div>
      </section>

      {/* Story sections */}
      <section className="container pb-16">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>The problem</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Low birth weight (&lt; 5.5 lb) is linked to higher infant mortality, developmental delays, and
              long-term health complications. Identifying the strongest drivers early helps clinicians and
              expecting parents act sooner.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>The data</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              101,400 pregnancy records with 37 features — demographics, pregnancy history, prenatal care,
              lifestyle, and maternal medical conditions. Cleaned to {metrics.n_rows.toLocaleString()} rows
              after IQR outlier removal and missing-value handling.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>The model</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Binomial logistic regression fit via IRLS (same algorithm as R&rsquo;s <code>glm</code>).
              Trained in Python, served via a lightweight serverless function — no heavy ML runtime at the edge.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Top predictors teaser */}
      <section className="container pb-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Top risk factors, at a glance</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Odds ratios from the fitted model (p &lt; 0.05). Above 1 increases risk, below 1 is protective.
              </p>
            </div>
            <Link href="/findings" className="hidden text-sm font-medium text-primary hover:underline md:inline">
              Full analysis →
            </Link>
          </div>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {top_predictors.slice(0, 6).map((p) => (
                  <li key={p.name} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="font-medium">{p.pretty_name}</p>
                      <p className="text-xs text-muted-foreground">
                        p = {p.p_value ? p.p_value.toExponential(2) : "—"}
                      </p>
                    </div>
                    <Badge variant={p.odds_ratio > 1 ? "danger" : "success"}>
                      {p.odds_ratio > 1 ? "Risk" : "Protective"} · OR {p.odds_ratio.toFixed(2)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}
