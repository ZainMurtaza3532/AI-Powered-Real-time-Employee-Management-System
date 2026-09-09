import mongoose, { Schema } from "mongoose";

export type ExpenseCategory =
  | "travel"
  | "meals"
  | "office_supplies"
  | "software"
  | "training"
  | "hardware"
  | "other";

export type ExpenseStatus = "pending" | "approved" | "rejected" | "reimbursed";

export interface IExpense extends mongoose.Document {
  employee: mongoose.Types.ObjectId;
  title: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  date: Date;
  description: string;
  receiptName?: string;
  status: ExpenseStatus;
  reviewedBy?: mongoose.Types.ObjectId | null;
  reviewedAt?: Date | null;
  rejectionReason?: string;
  reimbursedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    category: {
      type: String,
      enum: [
        "travel",
        "meals",
        "office_supplies",
        "software",
        "training",
        "hardware",
        "other",
      ],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      default: "USD",
      trim: true,
      uppercase: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    receiptName: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "reimbursed"],
      default: "pending",
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    reimbursedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

expenseSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    delete json.__v;
    return json;
  },
});

export const Expense = mongoose.model<IExpense>("Expense", expenseSchema);
