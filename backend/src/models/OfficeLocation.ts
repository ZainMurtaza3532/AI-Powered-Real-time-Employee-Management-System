import mongoose, { Schema } from "mongoose";

export interface IOfficeLocation extends mongoose.Document {
  /** Name of the office branch (e.g. Lahore Head Office, Karachi Branch). */
  branchName: string;
  /** Array of whitelisted IPv4/IPv6 addresses or CIDR blocks for this branch. */
  ipAddresses: string[];
  /** Whether this branch location's IP whitelist is actively enforced. */
  isActive: boolean;
  /** Optional physical address or description. */
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

const officeLocationSchema = new Schema<IOfficeLocation>(
  {
    branchName: {
      type: String,
      required: [true, "Branch name is required"],
      unique: true,
      trim: true,
    },
    ipAddresses: {
      type: [String],
      default: [],
      validate: {
        validator: (ips: string[]) => Array.isArray(ips),
        message: "ipAddresses must be an array of strings",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    address: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Optimize lookups by active status
officeLocationSchema.index({ isActive: 1 });

// Never leak internal version key __v in JSON responses
officeLocationSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    delete json.__v;
    return json;
  },
});

export const OfficeLocation = mongoose.model<IOfficeLocation>(
  "OfficeLocation",
  officeLocationSchema
);

export default OfficeLocation;
