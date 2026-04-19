import { FindingsCharts } from "./findings-charts";
import modelData from "@/public/model.json";
import type { ModelJSON } from "@/lib/model";

export const metadata = {
  title: "Findings · Birth Weight Risk",
  description: "Top predictors, odds ratios, and model performance for the low-birth-weight logistic regression.",
};

export default function FindingsPage() {
  const model = modelData as ModelJSON;
  return (
    <div className="container py-10 md:py-14">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Findings</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            The fitted logistic regression surfaces clinical and lifestyle factors consistent with the
            literature on low birth weight. Odds ratios above 1 increase risk; below 1 are protective.
          </p>
        </div>
        <FindingsCharts model={model} />
      </div>
    </div>
  );
}
