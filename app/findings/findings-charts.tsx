"use client";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ModelJSON } from "@/lib/model";

export function FindingsCharts({ model }: { model: ModelJSON }) {
  const { metrics, coefficients_table } = model;

  const significant = useMemo(
    () =>
      coefficients_table
        .filter((c) => c.name !== "(Intercept)" && (c.p_value ?? 1) < 0.05)
        .sort((a, b) => Math.abs(b.coef) - Math.abs(a.coef)),
    [coefficients_table],
  );

  const top10 = significant.slice(0, 10).map((c) => ({
    name: c.pretty_name,
    oddsRatio: c.odds_ratio,
    isRisk: c.odds_ratio > 1,
  }));

  const splitTop = {
    risk: significant.filter((c) => c.odds_ratio > 1).slice(0, 8).map((c) => ({
      name: c.pretty_name,
      oddsRatio: c.odds_ratio,
    })),
    protective: significant.filter((c) => c.odds_ratio < 1).slice(0, 8).map((c) => ({
      name: c.pretty_name,
      oddsRatio: c.odds_ratio,
    })),
  };

  const { tp, tn, fp, fn } = metrics.confusion_matrix;

  return (
    <div className="space-y-6">
      {/* Model performance */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="ROC-AUC" value={metrics.auc.toFixed(3)} hint="Ranking quality" />
        <MetricCard label="Accuracy" value={`${(metrics.accuracy * 100).toFixed(1)}%`} hint={`base rate ${(metrics.base_rate * 100).toFixed(1)}%`} />
        <MetricCard label="Precision" value={`${(metrics.precision * 100).toFixed(1)}%`} hint="of predicted LBW" />
        <MetricCard label="Recall" value={`${(metrics.recall * 100).toFixed(1)}%`} hint="of true LBW cases" />
      </div>

      {/* Top 10 predictors */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 predictors by |log-OR|</CardTitle>
          <CardDescription>
            Odds ratios for the ten most influential features (p &lt; 0.05). The red reference line marks OR = 1 (no effect).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[420px] w-full">
            <ResponsiveContainer>
              <BarChart data={top10} layout="vertical" margin={{ left: 24, right: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => v.toFixed(2)}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={200}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [value.toFixed(3), "Odds Ratio"]}
                />
                <ReferenceLine x={1} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
                <Bar dataKey="oddsRatio" radius={[0, 6, 6, 0]}>
                  {top10.map((d, i) => (
                    <Cell key={i} fill={d.isRisk ? "hsl(351 83% 61%)" : "hsl(160 84% 39%)"} />
                  ))}
                  <LabelList
                    dataKey="oddsRatio"
                    position="right"
                    formatter={(v: number) => v.toFixed(2)}
                    fontSize={11}
                    fill="hsl(var(--foreground))"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Risk vs protective split */}
      <div className="grid gap-4 md:grid-cols-2">
        <SplitPanel
          title="Top risk factors"
          description="Features that increase the odds of low birth weight"
          color="hsl(351 83% 61%)"
          data={splitTop.risk}
        />
        <SplitPanel
          title="Top protective factors"
          description="Features that decrease the odds of low birth weight"
          color="hsl(160 84% 39%)"
          data={splitTop.protective}
        />
      </div>

      {/* Confusion matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Confusion matrix (training set)</CardTitle>
          <CardDescription>At the 0.5 probability threshold. Low recall is typical with such an imbalanced base rate.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mx-auto grid max-w-md grid-cols-3 gap-2 text-center text-sm">
            <div />
            <div className="text-xs font-medium text-muted-foreground">Pred. Normal</div>
            <div className="text-xs font-medium text-muted-foreground">Pred. LBW</div>
            <div className="flex items-center justify-end pr-2 text-xs font-medium text-muted-foreground">Actual Normal</div>
            <CMCell value={tn} label="TN" tone="success" />
            <CMCell value={fp} label="FP" tone="muted" />
            <div className="flex items-center justify-end pr-2 text-xs font-medium text-muted-foreground">Actual LBW</div>
            <CMCell value={fn} label="FN" tone="muted" />
            <CMCell value={tp} label="TP" tone="success" />
          </div>
        </CardContent>
      </Card>

      {/* Full coefficient table (collapsed view) */}
      <Card>
        <CardHeader>
          <CardTitle>All significant predictors (p &lt; 0.05)</CardTitle>
          <CardDescription>
            {significant.length} features out of {metrics.n_features} reached statistical significance.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background text-left">
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="p-3 font-medium">Feature</th>
                  <th className="p-3 font-medium">OR</th>
                  <th className="p-3 font-medium">95% CI</th>
                  <th className="p-3 font-medium">p</th>
                  <th className="p-3 font-medium">Effect</th>
                </tr>
              </thead>
              <tbody>
                {significant.map((c) => (
                  <tr key={c.name} className="border-b">
                    <td className="p-3">{c.pretty_name}</td>
                    <td className="p-3 tabular-nums">{c.odds_ratio.toFixed(3)}</td>
                    <td className="p-3 tabular-nums text-xs text-muted-foreground">
                      {c.ci_lower?.toFixed(2) ?? "—"} – {c.ci_upper?.toFixed(2) ?? "—"}
                    </td>
                    <td className="p-3 tabular-nums text-xs text-muted-foreground">
                      {c.p_value?.toExponential(2) ?? "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant={c.odds_ratio > 1 ? "danger" : "success"}>
                        {c.odds_ratio > 1 ? "Risk" : "Protective"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SplitPanel({
  title,
  description,
  color,
  data,
}: {
  title: string;
  description: string;
  color: string;
  data: Array<{ name: string; oddsRatio: number }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ left: 12, right: 36 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => v.toFixed(2)} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis type="category" dataKey="name" width={180} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))" }}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number) => [value.toFixed(3), "Odds Ratio"]}
              />
              <Bar dataKey="oddsRatio" fill={color} radius={[0, 4, 4, 0]}>
                <LabelList
                  dataKey="oddsRatio"
                  position="right"
                  formatter={(v: number) => v.toFixed(2)}
                  fontSize={10}
                  fill="hsl(var(--foreground))"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  );
}

function CMCell({ value, label, tone }: { value: number; label: string; tone: "success" | "muted" }) {
  return (
    <div
      className={
        tone === "success"
          ? "flex flex-col items-center justify-center rounded-md bg-emerald-500/10 p-6"
          : "flex flex-col items-center justify-center rounded-md bg-muted p-6"
      }
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</span>
    </div>
  );
}
