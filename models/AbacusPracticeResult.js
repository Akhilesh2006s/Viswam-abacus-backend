import mongoose from 'mongoose';

const abacusPracticeResultSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userRole: { type: String, enum: ['student', 'teacher'], required: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    mode: { type: String, default: 'practice', trim: true },
    category: { type: String, default: '', trim: true },
    levelName: { type: String, default: '', trim: true },
    levelRank: { type: Number, default: 0 },
    questionSetId: { type: mongoose.Schema.Types.ObjectId, ref: 'AbacusQuestionSet', default: null },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    timeTaken: { type: Number, default: null },
  },
  { timestamps: true, collection: 'abacus_practice_results' },
);

abacusPracticeResultSchema.index({ email: 1, createdAt: -1 });

export default mongoose.model('AbacusPracticeResult', abacusPracticeResultSchema);
