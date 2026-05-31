import bcrypt from 'bcryptjs';
import AbacusTeacher from '../models/AbacusTeacher.js';
import AbacusStudent from '../models/AbacusStudent.js';
import { cleanCsvCell } from '../utils/csv-encoding.js';
import { spreadsheetBufferToCsv } from '../utils/spreadsheet-to-csv.js';
import {
  getCatalogCategories,
  createTeacher,
  createStudent,
} from './abacusService.js';
import { normalizeAbacusEmail, validateCategoryLevel } from '../constants/abacusCatalog.js';

const HEADER_ALIASES = {
  classname: 'class',
  classnumb: 'class',
  classnumber: 'class',
  pwd: 'password',
  cat: 'category',
  lvl: 'level',
};

export function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(cleanCsvCell(current));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(cleanCsvCell(current));
  return result;
}

export function normalizeCsvHeader(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^"|"$/g, '');
  return HEADER_ALIASES[s] || s;
}

function parseCsvFile(fileBuffer, originalName) {
  let csvData;
  try {
    ({ csv: csvData } = spreadsheetBufferToCsv(fileBuffer, originalName));
  } catch (err) {
    throw new Error(`Failed to read uploaded file: ${err.message}`);
  }

  const lines = csvData.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    throw new Error('File must have at least a header row and one data row');
  }

  const headers = parseCSVLine(lines[0]).map((h) => normalizeCsvHeader(h));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map((v) => String(v).trim().replace(/^"|"$/g, ''));
    if (values.every((v) => !v)) continue;
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    rows.push({ rowNum: i + 1, row });
  }

  return { headers, rows };
}

export async function importAbacusTeachersCsv(schoolId, fileBuffer, originalName) {
  const { headers, rows } = parseCsvFile(fileBuffer, originalName);
  const missing = ['name', 'email', 'password', 'category', 'level'].filter((h) => !headers.includes(h));
  if (missing.length) {
    throw new Error(`Missing required headers: ${missing.join(', ')}`);
  }

  const categories = await getCatalogCategories();
  const created = [];
  const errors = [];

  for (const { rowNum, row } of rows) {
    try {
      const teacher = await createTeacher(schoolId, {
        name: row.name,
        email: normalizeAbacusEmail(row.email),
        password: row.password,
        phone: row.phone || '',
        category: row.category,
        level: row.level,
      });
      created.push(teacher);
    } catch (err) {
      errors.push(`Row ${rowNum}: ${err.message}`);
    }
  }

  return { created: created.length, errors, teachers: created };
}

export async function importAbacusStudentsCsv(schoolId, fileBuffer, originalName) {
  const { headers, rows } = parseCsvFile(fileBuffer, originalName);
  const missing = ['name', 'email', 'password', 'category', 'level'].filter((h) => !headers.includes(h));
  if (missing.length) {
    throw new Error(`Missing required headers: ${missing.join(', ')}`);
  }

  const created = [];
  const errors = [];

  for (const { rowNum, row } of rows) {
    try {
      const student = await createStudent(schoolId, {
        name: row.name,
        email: normalizeAbacusEmail(row.email),
        password: row.password,
        class: row.class || '',
        category: row.category,
        level: row.level,
      });
      created.push(student);
    } catch (err) {
      errors.push(`Row ${rowNum}: ${err.message}`);
    }
  }

  return { created: created.length, errors, students: created };
}

/** Used by login — find abacus teacher/student by email */
export async function findAbacusTeacherForLogin(email, password) {
  const teacher = await AbacusTeacher.findOne({
    email: String(email).toLowerCase().trim(),
    isActive: { $ne: false },
  });
  if (!teacher) return null;
  const ok = await bcrypt.compare(password, teacher.password || '');
  if (!ok) return null;
  teacher.lastLogin = new Date();
  await teacher.save();
  return teacher;
}

export async function findAbacusStudentForLogin(email, password) {
  const student = await AbacusStudent.findOne({
    email: String(email).toLowerCase().trim(),
    isActive: { $ne: false },
  });
  if (!student) return null;
  const ok = await bcrypt.compare(password, student.password || '');
  if (!ok) return null;
  student.lastLogin = new Date();
  await student.save();
  return student;
}
