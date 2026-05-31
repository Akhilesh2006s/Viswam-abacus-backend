import mongoose from 'mongoose';

const questionItemSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true },
    type: { type: String, default: 'standard', trim: true },
    numbers: { type: [mongoose.Schema.Types.Mixed], default: [] },
    ops: { type: [String], default: [] },
    total: { type: Number, required: true },
  },
  { _id: false },
);

const abacusQuestionSetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userRole: { type: String, enum: ['student', 'teacher'], required: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    mode: { type: String, default: 'practice', trim: true },
    category: { type: String, required: true, trim: true },
    levelName: { type: String, required: true, trim: true },
    levelRank: { type: Number, default: 0 },
    questions: { type: [questionItemSchema], default: [] },
    resultId: { type: mongoose.Schema.Types.ObjectId, ref: 'AbacusPracticeResult', default: null },
  },
  { timestamps: true, collection: 'abacus_question_sets' },
);

abacusQuestionSetSchema.index({ email: 1, createdAt: -1 });
abacusQuestionSetSchema.index({ category: 1, levelName: 1, createdAt: -1 });

export default mongoose.model('AbacusQuestionSet', abacusQuestionSetSchema);
