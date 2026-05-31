import mongoose from 'mongoose';

const abacusTeacherSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    phone: { type: String, default: '' },
    category: { type: String, required: true, trim: true },
    level: { type: String, required: true, trim: true },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AbacusSchool',
      required: true,
    },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true, collection: 'abacus_teachers' },
);

abacusTeacherSchema.index({ email: 1 });
abacusTeacherSchema.index({ schoolId: 1 });
abacusTeacherSchema.index({ schoolId: 1, isActive: 1 });

export default mongoose.model('AbacusTeacher', abacusTeacherSchema);
