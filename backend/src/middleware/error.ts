import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const validationLabels: Record<string, string> = {
  name: 'Name',
  employeeId: 'Employee ID',
  email: 'Email',
  phone: 'Phone number',
  department: 'Department',
  designation: 'Designation',
  password: 'Password',
  'company.companyName': 'Company name',
  'company.cin': 'CIN',
  'company.pan': 'PAN',
  'company.gstin': 'GSTIN',
  'company.msmeNumber': 'MSME number',
};

function cleanValidationPath(path: PropertyKey[]) {
  const values = path.map(String);
  return values[0] === 'body' ? values.slice(1) : values;
}

function validationMessage(path: string[], message: string) {
  const key = path.join('.');
  return `${(validationLabels[key] ?? key) || 'Request'}: ${message}`;
}

function uniqueTarget(error: Prisma.PrismaClientKnownRequestError) {
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  return Array.isArray(target) ? target.map(String).join(',') : String(target ?? '');
}

function uniqueConstraintMessage(target: string) {
  const labels: Record<string, string> = {
    email: 'Email is already registered',
    phone: 'Phone number is already registered',
    employeeId: 'Employee ID is already registered',
    cin: 'CIN is already registered',
    pan: 'PAN is already registered',
    gstin: 'GSTIN is already registered',
    msmeNumber: 'MSME number is already registered',
  };
  const field = Object.keys(labels).find((key) => target.includes(key));
  return field ? { message: labels[field], field } : { message: 'A record with this unique value already exists', field: target || 'record' };
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    const errors = error.issues.map((issue) => {
      const path = cleanValidationPath(issue.path);
      return { path, code: issue.code, message: issue.message };
    });
    const first = errors[0];
    return res.status(400).json({
      success: false,
      message: first ? validationMessage(first.path, first.message) : 'Validation failed',
      errors,
    });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const duplicate = uniqueConstraintMessage(uniqueTarget(error));
      return res.status(409).json({
        success: false,
        message: duplicate.message,
        errors: [{ path: [duplicate.field], code: 'unique', message: duplicate.message }],
      });
    }
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Resource not found', errors: [] });
  }
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message, errors: error.errors });
  console.error(error);
  return res.status(500).json({ success: false, message: env.nodeEnv === 'production' ? 'Internal server error' : error instanceof Error ? error.message : 'Internal server error', errors: [] });
};
