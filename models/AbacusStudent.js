import mongoose from 'mongoose';

const abacusStudentSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    username: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    className: { type: String, trim: true, default: '' },
    category: { type: String, required: true, trim: true },
    level: { type: String, required: true, trim: true },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AbacusSchool',
      required: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AbacusTeacher',
      default: null,
      index: true,
    },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true, collection: 'abacus_students' },
);

abacusStudentSchema.index({ username: 1 });
abacusStudentSchema.index({ email: 1 });
abacusStudentSchema.index({ schoolId: 1 });
abacusStudentSchema.index({ schoolId: 1, isActive: 1 });

export default mongoose.model('AbacusStudent', abacusStudentSchema);
