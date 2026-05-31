import mongoose from 'mongoose';

const categorySchema = {
  name: { type: String, required: true, trim: true },
  levels: { type: [String], default: [] },
};

const abacusCatalogSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'default' },
    categories: { type: [categorySchema], default: [] },
  },
  { timestamps: true, collection: 'abacus_catalog' },
);

export default mongoose.model('AbacusCatalog', abacusCatalogSchema);
