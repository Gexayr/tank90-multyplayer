import mongoose, { Schema, Document } from 'mongoose';

export interface IScore extends Document {
  playerId: string;
  score: number;
}

const ScoreSchema: Schema = new Schema({
  playerId: { type: String, required: true },
  score: { type: Number, required: true },
});

export default mongoose.model<IScore>('Score', ScoreSchema);
