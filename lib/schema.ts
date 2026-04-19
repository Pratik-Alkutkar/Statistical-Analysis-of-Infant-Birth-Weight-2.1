export type FeatureField =
  | {
      key: string;
      label: string;
      type: "number";
      min: number;
      max: number;
      default: number;
      section: string;
    }
  | {
      key: string;
      label: string;
      type: "boolean";
      default: number;
      section: string;
    }
  | {
      key: string;
      label: string;
      type: "select" | "race" | "hispanic";
      options: Array<{ value: string | number; label: string }>;
      default: string | number;
      section: string;
    };
