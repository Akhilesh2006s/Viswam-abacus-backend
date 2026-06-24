import mongoose from 'mongoose';

const schoolDetailsSchema = {
  doorNo: { type: String, trim: true, default: '' },
  street: { type: String, trim: true, default: '' },
  area: { type: String, trim: true, default: '' },
  city: { type: String, trim: true, default: '' },
  district: { type: String, trim: true, default: '' },
  state: { type: String, trim: true, default: '' },
  medium: { type: String, trim: true, default: '' },
  schoolType: { type: String, trim: true, default: '' },
};

const abacusSchoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    schoolCode: {
      type: String,
      uppercase: true,
      trim: true,
      unique: true,
      sparse: true,
    },
    contactPerson: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    place: { type: String, trim: true, default: '' },
    pin: { type: String, trim: true, default: '' },
    schoolDetails: {
      type: schoolDetailsSchema,
      default: () => ({}),
    },
    notes: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
    level: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'abacus_schools' },
);

abacusSchoolSchema.index({ name: 1 });
abacusSchoolSchema.index({ isActive: 1 });

export default mongoose.model('AbacusSchool', abacusSchoolSchema);
