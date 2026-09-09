import mongoose, { Schema } from "mongoose";

export type OkrLevel = "company" | "department" | "individual";
export type OkrStatus = "active" | "completed" | "archived";
export type KeyResultStatus = "on_track" | "at_risk" | "behind" | "completed";

export interface IKeyResult {
  _id?: mongoose.Types.ObjectId;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  progress: number; // 0 - 100
  status: KeyResultStatus;
}

export interface IOkr extends mongoose.Document {
  title: string;
  description?: string;
  period: string; // e.g. "Q1 2026", "Q2 2026", "Annual 2026"
  level: OkrLevel;
  department?: mongoose.Types.ObjectId | null;
  owner: mongoose.Types.ObjectId;
  keyResults: IKeyResult[];
  overallProgress: number; // 0 - 100
  status: OkrStatus;
  createdAt: Date;
  updatedAt: Date;
}

const keyResultSchema = new Schema<IKeyResult>(
  {
    title: { type: String, required: true, trim: true },
    targetValue: { type: Number, required: true, min: 0 },
    currentValue: { type: Number, required: true, min: 0, default: 0 },
    unit: { type: String, required: true, trim: true, default: "%" },
    progress: { type: Number, required: true, min: 0, max: 100, default: 0 },
    status: {
      type: String,
      enum: ["on_track", "at_risk", "behind", "completed"],
      default: "on_track",
    },
  },
  { _id: true }
);

const okrSchema = new Schema<IOkr>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    period: {
      type: String,
      required: true,
      trim: true,
      default: "Q1 2026",
      index: true,
    },
    level: {
      type: String,
      enum: ["company", "department", "individual"],
      default: "individual",
      index: true,
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
      index: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    keyResults: {
      type: [keyResultSchema],
      default: [],
    },
    overallProgress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "completed", "archived"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

okrSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    delete json.__v;
    return json;
  },
});

export const Okr = mongoose.model<IOkr>("Okr", okrSchema);
