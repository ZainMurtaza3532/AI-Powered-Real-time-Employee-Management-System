import mongoose, { Schema } from "mongoose";

export type PaymentStatus = "pending" | "processing" | "paid" | "failed";
export type PaymentMethod = "bank_transfer" | "check" | "direct_deposit";

export interface IAllowances {
  housing: number;
  transport: number;
  medical: number;
  other: number;
}

export interface IDeductions {
  tax: number;
  pension: number;
  unpaidLeave: number;
  other: number;
}

export interface IPayroll extends mongoose.Document {
  employee: mongoose.Types.ObjectId;
  month: number; // 1 - 12
  year: number; // e.g. 2026
  basicSalary: number;
  allowances: IAllowances;
  deductions: IDeductions;
  grossSalary: number;
  netSalary: number;
  paymentStatus: PaymentStatus;
  paymentDate?: Date | null;
  paymentMethod: PaymentMethod;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const allowancesSchema = new Schema<IAllowances>(
  {
    housing: { type: Number, default: 0, min: 0 },
    transport: { type: Number, default: 0, min: 0 },
    medical: { type: Number, default: 0, min: 0 },
    other: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const deductionsSchema = new Schema<IDeductions>(
  {
    tax: { type: Number, default: 0, min: 0 },
    pension: { type: Number, default: 0, min: 0 },
    unpaidLeave: { type: Number, default: 0, min: 0 },
    other: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const payrollSchema = new Schema<IPayroll>(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
    },
    basicSalary: {
      type: Number,
      required: true,
      min: 0,
    },
    allowances: {
      type: allowancesSchema,
      default: () => ({ housing: 0, transport: 0, medical: 0, other: 0 }),
    },
    deductions: {
      type: deductionsSchema,
      default: () => ({ tax: 0, pension: 0, unpaidLeave: 0, other: 0 }),
    },
    grossSalary: {
      type: Number,
      required: true,
      min: 0,
    },
    netSalary: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "processing", "paid", "failed"],
      default: "pending",
      index: true,
    },
    paymentDate: {
      type: Date,
      default: null,
    },
    paymentMethod: {
      type: String,
      enum: ["bank_transfer", "check", "direct_deposit"],
      default: "bank_transfer",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

// Ensure only one payroll record per employee per month/year
payrollSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

payrollSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    delete json.__v;
    return json;
  },
});

export const Payroll = mongoose.model<IPayroll>("Payroll", payrollSchema);
