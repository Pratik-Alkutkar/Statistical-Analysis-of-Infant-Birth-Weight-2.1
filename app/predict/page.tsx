import { PredictForm } from "./predict-form";
import modelData from "@/public/model.json";
import schemaData from "@/public/feature_schema.json";
import type { ModelJSON } from "@/lib/model";
import type { FeatureField } from "@/lib/schema";

export const metadata = {
  title: "Predict · Birth Weight Risk",
  description:
    "Enter pregnancy details and see the predicted low-birth-weight probability along with the top contributing factors.",
};

export default function PredictPage() {
  return (
    <div className="container py-10 md:py-14">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Predict low-birth-weight risk</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Fill in what you know — the model is fully client-aware, so updates happen live as you edit.
            This is a research project and is <strong>not medical advice</strong>.
          </p>
        </div>
        <PredictForm model={modelData as ModelJSON} schema={schemaData as FeatureField[]} />
      </div>
    </div>
  );
}
