import type { Request, Response } from 'express';
import * as service from '../services/auth.service.js';
import { success, message } from '../utils/response.js';

export const registerOfficer = async (req:Request,res:Response) => success(res, await service.registerOfficer(req.body), 201);
export const registerBidder = async (req:Request,res:Response) => success(res, await service.registerBidder(req.body), 201);
export const login = async (req:Request,res:Response) => success(res, await service.login(req.body.email,req.body.password));
export const me = async (req:Request,res:Response) => success(res, await service.getCurrentUser(req.auth!.userId));
export const refresh = async (req:Request,res:Response) => success(res, await service.refresh(req.body.refreshToken));
export const logout = async (req:Request,res:Response) => { await service.logout(req.body.refreshToken); return message(res,'Logged out successfully'); };
export const sendEmail = async (req:Request,res:Response) => res.json(await service.sendEmail(req.body.email));
export const verifyEmail = async (req:Request,res:Response) => res.json(await service.verifyEmail(req.body.email,req.body.code));
export const forgot = async (_req:Request,res:Response) => success(res, await service.forgotPassword());
export const reset = async (req:Request,res:Response) => success(res, await service.resetPassword());
