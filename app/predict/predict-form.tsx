"use client";
import { useMemo, useState, useTransition } from "react";
import { AlertCircle, Loader2, Wand2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { predict, type ModelJSON, type PredictionResult, type UserInput } from "@/lib/model";
import type { FeatureField } from "@/lib/schema";
import { cn } from "@/lib/utils";

interface Props {
  model: ModelJSON;
  schema: FeatureField[];
}

function buildDefaults(schema: FeatureField[]): UserInput {
  const out: UserInput = {};
  for (const f of schema) {
    out[f.key] = f.default as number | string;
  }
  return out;
}

export function PredictForm({ model, schema }: Props) {
  const [values, setValues] = useState<UserInput>(() => buildDefaults(schema));
  const [pending, startTransition] = useTransition();
  const [serverResult, setServerResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live client-side prediction (instant feedback while editing)
  const clientResult = useMemo(() => predict(model, values), [model, values]);

  const result = serverResult ?? clientResult;

  const sections = useMemo(() => {
    const bySection: Record<string, FeatureField[]> = {};
    for (const f of schema) {
      (bySection[f.section] ??= []).push(f);
    }
    return Object.entries(bySection);
  }, [schema]);

  function setValue(key: string, value: number | string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setServerResult(null); // invalidate server result on edit
  }

  function submitToServer() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/predict", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(values),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as PredictionResult;
        setServerResult(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Left: form */}
      <div className="space-y-6">
        {sections.map(([section, fields]) => (
          <Card key={section}>
            <CardHeader>
              <CardTitle>{section}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              {fields.map((f) => (
                <FieldRow
                  key={f.key}
                  field={f}
                  value={values[f.key]}
                  onChange={(v) => setValue(f.key, v)}
                />
              ))}
            </CardContent>
          </Card>
        ))}
        <div className="flex flex-wrap gap-3">
          <Button onClick={submitToServer} disabled={pending} size="lg">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Run full prediction
          </Button>
          <Button
            onClick={() => setValues(buildDefaults(schema))}
            variant="outline"
            size="lg"
          >
            Reset
          </Button>
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}
        </div>
      </div>

      {/* Right: result panel */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <ResultPanel result={result} />
      </div>
    </div>
  );
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: FeatureField;
  value: number | string;
  onChange: (v: number | string) => void;
}) {
  if (field.type === "number") {
    const numVal = Number(value);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={field.key}>{field.label}</Label>
          <span className="tabular-nums text-sm text-muted-foreground">{numVal}</span>
        </div>
        <Slider
          id={field.key}
          min={field.min}
          max={field.max}
          value={numVal}
          onChange={(v) => onChange(v)}
        />
      </div>
    );
  }
  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-3 rounded-md border bg-background p-3">
        <Checkbox
          checked={Number(value) === 1}
          onChange={(e) => onChange(e.currentTarget.checked ? 1 : 0)}
        />
        <span className="text-sm font-medium">{field.label}</span>
      </label>
    );
  }
  return (
    <div className="space-y-2">
      <Label htmlFor={field.key}>{field.label}</Label>
      <Select
        id={field.key}
        value={String(value)}
        onChange={(e) => {
          const raw = e.currentTarget.value;
          // preserve numeric types for numeric options
          const match = field.options.find((o) => String(o.value) === raw);
          onChange(match ? (match.value as number | string) : raw);
        }}
      >
        {field.options.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

function ResultPanel({ result }: { result: PredictionResult }) {
  const pct = result.probability * 100;
  const tone =
    result.risk === "high"
      ? "danger"
      : result.risk === "moderate"
        ? "warning"
        : "success";
  const ringColor =
    result.risk === "high"
      ? "stroke-rose-500"
      : result.risk === "moderate"
        ? "stroke-amber-500"
        : "stroke-emerald-500";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Predicted risk</CardTitle>
          <Badge variant={tone as any}>{result.risk}</Badge>
        </div>
        <CardDescription>Probability of low birth weight (&lt; 5.5 lb)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-center">
          <Gauge pct={pct} ringColor={ringColor} />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Top contributing factors</p>
          {result.topContributors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No non-default features. Adjust inputs to see contributors.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {result.topContributors.map((c) => {
                const or = Math.exp(c.contribution);
                const positive = c.contribution > 0;
                return (
                  <li
                    key={c.name}
                    className="flex items-center justify-between rounded-md bg-secondary/60 px-3 py-2 text-sm"
                  >
                    <span className="truncate pr-2">{c.pretty_name}</span>
                    <span
                      className={cn(
                        "tabular-nums text-xs font-medium",
                        positive ? "text-rose-600" : "text-emerald-600",
                      )}
                    >
                      {positive ? "↑" : "↓"} ×{or.toFixed(2)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          This is a research model. Do not use for clinical decisions.
        </p>
      </CardContent>
    </Card>
  );
}

function Gauge({ pct, ringColor }: { pct: number; ringColor: string }) {
  // Ring at 12 o'clock, 270° sweep for a "three-quarters" gauge feel.
  const size = 180;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const dash = (clamped / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        className="stroke-border"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        className={ringColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="48%"
        textAnchor="middle"
        className="fill-foreground text-3xl font-semibold"
      >
        {pct.toFixed(1)}%
      </text>
      <text x="50%" y="62%" textAnchor="middle" className="fill-muted-foreground text-xs">
        low birth weight
      </text>
    </svg>
  );
}
