import mongoose, { Schema } from "mongoose";

export type KudosBadge =
  | "problem_solver"
  | "team_player"
  | "speed_demon"
  | "innovator"
  | "culture_champion"
  | "mentor"
  | "customer_hero";

export interface IKudosReaction {
  user: mongoose.Types.ObjectId;
  emoji: string; // e.g. "👏", "❤️", "🚀", "💡", "🔥"
}

export interface IKudos extends mongoose.Document {
  sender: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  badge: KudosBadge;
  message: string;
  reactions: IKudosReaction[];
  createdAt: Date;
  updatedAt: Date;
}

const kudosReactionSchema = new Schema<IKudosReaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true },
  },
  { _id: false }
);

const kudosSchema = new Schema<IKudos>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    badge: {
      type: String,
      enum: [
        "problem_solver",
        "team_player",
        "speed_demon",
        "innovator",
        "culture_champion",
        "mentor",
        "customer_hero",
      ],
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    reactions: {
      type: [kudosReactionSchema],
      default: [],
    },
  },
  { timestamps: true }
);

kudosSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    delete json.__v;
    return json;
  },
});

export const Kudos = mongoose.model<IKudos>("Kudos", kudosSchema);
